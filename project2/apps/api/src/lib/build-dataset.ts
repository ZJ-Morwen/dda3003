import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse";

import type { EmissionSeriesPoint, SourceType } from "../../../../shared/contracts.js";
import { computeBounds, haversineNm, interpolateAlongLine, parseLineStringWkt } from "./geo.js";
import type {
  DatasetMeta,
  DatasetVoyage,
  MockVoyageSeed,
  PortFlowSeed,
  RawSummary,
  RealDataset
} from "./internal-types.js";
import { average, median, round } from "./stats.js";
import { isoToDay } from "./time.js";

interface CleanRow {
  mmsi: string;
  lon: string;
  lat: string;
  sog: string;
  hdg: string;
  cog: string;
  ts: string;
  voyage_uuid: string;
  route_line: string;
}

interface RawRow {
  mmsi: string;
  postime: string;
}

interface TrackPointInput {
  ts: string;
  lat: number;
  lon: number;
  speed: number;
  heading: number | null;
  cog: number | null;
}

interface BuildVoyageInput {
  voyageId: string;
  voyageIndex: number;
  label: string;
  sourceType: SourceType;
  origin: string;
  destination: string;
  vesselId: string;
  track: TrackPointInput[];
  referenceRoute?: [number, number][];
  referenceSpeedProfile?: number[];
}

function toIsoShanghai(date: Date): string {
  const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return `${shifted.toISOString().slice(0, 19)}+08:00`;
}

function parseRawTimestamp(input: string): string {
  const match = input.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})\+(\d{2})$/
  );
  if (!match) {
    return input;
  }
  const [, day, month, year, hour, minute, second, offset] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hour}:${minute}:${second}+${offset}:00`;
}

async function streamCsv<T>(
  filePath: string,
  onRow: (row: T) => void
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const parser = parse({
      columns: true,
      skip_empty_lines: true,
      bom: true,
      trim: true
    });
    parser.on("readable", () => {
      let row: T | null;
      while ((row = parser.read() as T | null) !== null) {
        onRow(row);
      }
    });
    parser.on("end", () => resolve());
    parser.on("error", (error) => reject(error));
    createReadStream(filePath).pipe(parser);
  });
}

function interpolateSeries(values: number[], progress: number): number {
  if (values.length === 0) {
    return 0;
  }
  if (values.length === 1) {
    return values[0];
  }
  const target = Math.max(0, Math.min(1, progress)) * (values.length - 1);
  const left = Math.floor(target);
  const right = Math.min(values.length - 1, Math.ceil(target));
  const ratio = target - left;
  return values[left] + (values[right] - values[left]) * ratio;
}

function computeProgress(track: TrackPointInput[]): { distances: number[]; totalDistance: number; progress: number[] } {
  const distances = [0];
  for (let index = 1; index < track.length; index += 1) {
    const prev = track[index - 1];
    const current = track[index];
    distances.push(
      distances[index - 1] + haversineNm(prev.lat, prev.lon, current.lat, current.lon)
    );
  }
  const totalDistance = distances[distances.length - 1] || 1;
  const progress = distances.map((value, index) => {
    if (track.length === 1) {
      return 0;
    }
    return totalDistance === 0 ? index / (track.length - 1) : value / totalDistance;
  });
  return { distances, totalDistance, progress };
}

function sampleSpeedProfile(track: TrackPointInput[], bucketCount = 48): number[] {
  const { progress } = computeProgress(track);
  return Array.from({ length: bucketCount }, (_, index) => {
    const bucketProgress = index / (bucketCount - 1);
    for (let pointIndex = 1; pointIndex < progress.length; pointIndex += 1) {
      if (bucketProgress <= progress[pointIndex]) {
        const leftProgress = progress[pointIndex - 1];
        const rightProgress = progress[pointIndex];
        const ratio =
          rightProgress === leftProgress
            ? 0
            : (bucketProgress - leftProgress) / (rightProgress - leftProgress);
        return track[pointIndex - 1].speed + (track[pointIndex].speed - track[pointIndex - 1].speed) * ratio;
      }
    }
    return track[track.length - 1]?.speed ?? 0;
  });
}

export function buildMedianProfile(tracks: TrackPointInput[][], bucketCount = 48): number[] {
  const sampled = tracks.map((track) => sampleSpeedProfile(track, bucketCount));
  return Array.from({ length: bucketCount }, (_, index) =>
    median(sampled.map((profile) => profile[index] ?? 0))
  );
}

function buildReferenceRouteFromTrack(track: TrackPointInput[]): [number, number][] {
  if (track.length < 3) {
    return track.map((point) => [point.lon, point.lat]);
  }
  const first = track[0];
  const last = track[track.length - 1];
  return track.map((point, index) => {
    const progress = index / (track.length - 1);
    const straightLon = first.lon + (last.lon - first.lon) * progress;
    const straightLat = first.lat + (last.lat - first.lat) * progress;
    const blend = index === 0 || index === track.length - 1 ? 0 : 0.22;
    return [
      point.lon * (1 - blend) + straightLon * blend,
      point.lat * (1 - blend) + straightLat * blend
    ];
  });
}

function buildVoyageFromTrack(input: BuildVoyageInput): DatasetVoyage {
  const track = [...input.track].sort((left, right) => left.ts.localeCompare(right.ts));
  const actualRoute = track.map((point) => [point.lon, point.lat] as [number, number]);
  const referenceRoute =
    input.referenceRoute && input.referenceRoute.length > 1
      ? input.referenceRoute
      : buildReferenceRouteFromTrack(track);
  const referenceProfile =
    input.referenceSpeedProfile && input.referenceSpeedProfile.length > 0
      ? input.referenceSpeedProfile
      : sampleSpeedProfile(track).map((speed) => speed * 0.94);
  const { distances: actualDistances, totalDistance: actualTotalDistance, progress } = computeProgress(track);
  const referencePoints = progress.map((value) => interpolateAlongLine(referenceRoute, value));
  const referenceDistances = [0];
  for (let index = 1; index < referencePoints.length; index += 1) {
    const [prevLon, prevLat] = referencePoints[index - 1];
    const [lon, lat] = referencePoints[index];
    referenceDistances.push(
      referenceDistances[index - 1] + haversineNm(prevLat, prevLon, lat, lon)
    );
  }
  let cumulativeActualEmission = 0;
  let cumulativeStandardEmission = 0;
  const series: EmissionSeriesPoint[] = track.map((point, index) => {
    const actualSegmentDistance =
      index === 0 ? 0 : actualDistances[index] - actualDistances[index - 1];
    const [refLon, refLat] = referencePoints[index];
    const standardSpeed = interpolateSeries(referenceProfile, progress[index]);
    const standardSegmentDistance =
      index === 0 ? 0 : referenceDistances[index] - referenceDistances[index - 1];
    const actualEmission = actualSegmentDistance * point.speed ** 2;
    const standardEmission = standardSegmentDistance * standardSpeed ** 2;
    cumulativeActualEmission += actualEmission;
    cumulativeStandardEmission += standardEmission;
    return {
      ts: point.ts,
      day: isoToDay(point.ts),
      progress: round(progress[index], 6),
      lat: round(point.lat, 6),
      lon: round(point.lon, 6),
      refLat: round(refLat, 6),
      refLon: round(refLon, 6),
      actualSpeed: round(point.speed, 3),
      standardSpeed: round(standardSpeed, 3),
      actualEmission: round(actualEmission, 3),
      standardEmission: round(standardEmission, 3),
      deltaCumulative: round(cumulativeActualEmission - cumulativeStandardEmission, 3),
      sourceType: input.sourceType
    };
  });
  const startDate = new Date(track[0].ts);
  const endDate = new Date(track[track.length - 1].ts);
  const durationHours =
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
  const maxSpeed = Math.max(...track.map((point) => point.speed), 0);
  const avgSpeed = durationHours > 0 ? actualTotalDistance / durationHours : average(track.map((point) => point.speed));
  const totalEmission = series.reduce((sum, point) => sum + point.actualEmission, 0);
  const availableDays = [...new Set(series.map((point) => point.day))];
  return {
    voyageId: input.voyageId,
    voyageIndex: input.voyageIndex,
    label: input.label,
    sourceType: input.sourceType,
    origin: input.origin,
    destination: input.destination,
    vesselId: input.vesselId,
    startTs: track[0].ts,
    endTs: track[track.length - 1].ts,
    startDay: availableDays[0],
    endDay: availableDays[availableDays.length - 1],
    availableDays,
    emissionUnit: "score",
    bounds: computeBounds(actualRoute),
    actualRoute,
    referenceRoute,
    series,
    metrics: {
      durationHours: round(durationHours, 3),
      distanceNm: round(actualTotalDistance, 3),
      avgSpeed: round(avgSpeed, 3),
      maxSpeed: round(maxSpeed, 3),
      totalEmission: round(totalEmission, 3),
      emissionPerNm: round(totalEmission / (actualTotalDistance || 1), 3)
    }
  };
}

export async function buildRealDataset(
  cleanCsvPath: string,
  rawCsvPath: string
): Promise<RealDataset> {
  const rawVessels = new Set<string>();
  const cleanedVessels = new Set<string>();
  let rawFirst = "";
  let rawLast = "";
  let rawPointCount = 0;
  await streamCsv<RawRow>(rawCsvPath, (row) => {
    rawPointCount += 1;
    rawVessels.add(row.mmsi);
    const iso = parseRawTimestamp(row.postime);
    if (!rawFirst || iso < rawFirst) {
      rawFirst = iso;
    }
    if (!rawLast || iso > rawLast) {
      rawLast = iso;
    }
  });

  const voyageRows = new Map<
    string,
    {
      vesselId: string;
      routeLine: string;
      points: TrackPointInput[];
    }
  >();
  let cleanedPointCount = 0;
  let cleanedFirst = "";
  let cleanedLast = "";
  await streamCsv<CleanRow>(cleanCsvPath, (row) => {
    cleanedPointCount += 1;
    cleanedVessels.add(row.mmsi);
    if (!cleanedFirst || row.ts < cleanedFirst) {
      cleanedFirst = row.ts;
    }
    if (!cleanedLast || row.ts > cleanedLast) {
      cleanedLast = row.ts;
    }
    const existing = voyageRows.get(row.voyage_uuid) ?? {
      vesselId: row.mmsi,
      routeLine: row.route_line,
      points: []
    };
    existing.points.push({
      ts: row.ts,
      lat: Number(row.lat),
      lon: Number(row.lon),
      speed: Number(row.sog),
      heading: row.hdg ? Number(row.hdg) : null,
      cog: row.cog ? Number(row.cog) : null
    });
    existing.routeLine = existing.routeLine || row.route_line;
    voyageRows.set(row.voyage_uuid, existing);
  });

  const orderedVoyages = [...voyageRows.entries()].sort((left, right) =>
    left[1].points[0].ts.localeCompare(right[1].points[0].ts)
  );
  const corridorProfile = buildMedianProfile(orderedVoyages.map(([, value]) => value.points));
  const voyages = orderedVoyages.map(([voyageId, value], index) =>
    buildVoyageFromTrack({
      voyageId,
      voyageIndex: index + 1,
      label: `真实航次 ${index + 1}`,
      sourceType: "real",
      origin: "Tianjin",
      destination: "Qingdao",
      vesselId: value.vesselId,
      track: value.points,
      referenceRoute: parseLineStringWkt(value.routeLine),
      referenceSpeedProfile: corridorProfile
    })
  );
  const rawSummary: RawSummary = {
    rawPointCount,
    cleanedPointCount,
    rawUniqueVessels: rawVessels.size,
    cleanedUniqueVessels: cleanedVessels.size,
    voyageCount: voyages.length,
    rawDateRange: {
      start: rawFirst.slice(0, 10),
      end: rawLast.slice(0, 10)
    },
    cleanedDateRange: {
      start: cleanedFirst.slice(0, 10),
      end: cleanedLast.slice(0, 10)
    }
  };
  const meta: DatasetMeta = {
    generatedAt: new Date().toISOString(),
    latestDate: rawSummary.cleanedDateRange.end,
    dateRange: rawSummary.cleanedDateRange,
    rawSummary
  };
  return {
    meta,
    corridorProfile,
    voyages
  };
}

export function buildMockVoyages(
  seeds: MockVoyageSeed[],
  latestRealIndex: number
): DatasetVoyage[] {
  return seeds.map((seed, seedIndex) => {
    const track = seed.coordinates.map(([lon, lat], index) => {
      const ts = toIsoShanghai(
        new Date(new Date(seed.startTs).getTime() + index * seed.intervalMinutes * 60_000)
      );
      return {
        ts,
        lon,
        lat,
        speed: seed.speeds[index] ?? seed.speeds[seed.speeds.length - 1] ?? 12,
        heading: null,
        cog: null
      };
    });
    const referenceRoute = seed.coordinates.map(([lon, lat], index) => {
      if (index === 0 || index === seed.coordinates.length - 1) {
        return [lon, lat] as [number, number];
      }
      const next = seed.coordinates[index + 1] ?? seed.coordinates[index];
      return [round((lon + next[0]) / 2, 6), round((lat + next[1]) / 2, 6)] as [number, number];
    });
    const profile = sampleSpeedProfile(track).map((speed, index) =>
      index % 3 === 0 ? speed * 0.92 : speed * 0.95
    );
    return buildVoyageFromTrack({
      voyageId: seed.voyageId,
      voyageIndex: latestRealIndex + seedIndex + 1,
      label: seed.label,
      sourceType: "mock",
      origin: seed.source,
      destination: seed.target,
      vesselId: `mock-vessel-${seedIndex + 1}`,
      track,
      referenceRoute,
      referenceSpeedProfile: profile
    });
  });
}

export async function readJsonFile<T>(filePath: string): Promise<T> {
  const contents = await readFile(filePath, "utf8");
  return JSON.parse(contents) as T;
}

export function resolveProjectPath(...segments: string[]): string {
  return path.resolve(process.cwd(), ...segments);
}

export type { MockVoyageSeed, PortFlowSeed };
