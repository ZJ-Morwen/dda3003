import { createReadStream } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
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
  lon?: string;
  lat?: string;
  sog?: string;
  hdg?: string;
  cog?: string;
  ts?: string;
  voyage_uuid?: string;
  route_line?: string;
  timestamp?: string;
  timestamp_new?: string;
  latitude?: string;
  longitude?: string;
  speed?: string;
  course?: string;
  heading?: string;
  routeId?: string;
  vesselName?: string;
}

interface TrackPointInput {
  sequence?: number;
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

interface WeightedEdge {
  to: number;
  weight: number;
}

interface HeapEntry {
  index: number;
  distance: number;
}

interface CleanedCsvFile {
  filePath: string;
  fileKey: string;
}

const OBSERVED_PORT_CENTERS = {
  Tianjin: { lat: 39.45, lon: 119.32 },
  Qingdao: { lat: 36.01, lon: 120.47 },
  Ningbo: { lat: 29.98, lon: 122.52 },
  Shanghai: { lat: 31.28, lon: 122.02 },
  Shenzhen: { lat: 22.43, lon: 114.60 },
  Guangzhou: { lat: 21.96, lon: 113.85 }
} satisfies Record<string, { lat: number; lon: number }>;

function toIsoShanghai(date: Date): string {
  const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return `${shifted.toISOString().slice(0, 19)}+08:00`;
}

function normalizePortSlug(input: string): string {
  const normalized = input.trim().toLowerCase();
  return normalized === "qingdado" ? "qingdao" : normalized;
}

function parseRouteFromFilename(fileName: string): {
  fileKey: string;
} {
  const baseName = path.basename(fileName, path.extname(fileName));
  const slugs = baseName.split("_");
  if (slugs.length < 2) {
    throw new Error(`Unable to parse route from file name: ${fileName}`);
  }
  return {
    fileKey: slugs.map((slug) => normalizePortSlug(slug)).join("-")
  };
}

function parseFlexibleTimestamp(input: string): string {
  const value = input.trim();
  if (!value) {
    return value;
  }
  if (value.includes("T")) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toISOString();
  }
  const parts =
    value.match(
      /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/
    ) ??
    value.match(
      /^(\d{4})-(\d{1,2})-(\d{1,2})T(\d{1,2}):(\d{2})(?::(\d{2}))?$/
    );
  const pad = (raw: string) => raw.padStart(2, "0");
  const withZone = parts
    ? `${parts[1]}-${pad(parts[2])}-${pad(parts[3])}T${pad(parts[4])}:${pad(parts[5])}:${pad(parts[6] ?? "00")}+08:00`
    : /(?:Z|[+-]\d{2}:\d{2})$/.test(value)
      ? value
      : `${value.replace(/\//g, "-").replace(" ", "T")}+08:00`;
  const date = new Date(withZone);
  return Number.isNaN(date.getTime()) ? withZone : date.toISOString();
}

function inferPortLabel(lat: number, lon: number): string {
  const candidates = Object.entries(OBSERVED_PORT_CENTERS).map(([name, center]) => ({
    name,
    distance: haversineNm(lat, lon, center.lat, center.lon)
  }));
  candidates.sort((left, right) => left.distance - right.distance);
  return candidates[0]?.name ?? "Unknown";
}

function majorityLabel(labels: string[]): string {
  const counts = new Map<string, number>();
  for (const label of labels) {
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] ?? "Unknown";
}

function inferPortPairFromTrack(
  track: TrackPointInput[],
  fallback?: { origin: string; destination: string }
): { origin: string; destination: string } {
  if (track.length === 0) {
    return fallback ?? { origin: "Unknown", destination: "Unknown" };
  }

  const origin = inferPortLabel(track[0].lat, track[0].lon);
  const destination = inferPortLabel(track[track.length - 1].lat, track[track.length - 1].lon);

  if (origin !== destination) {
    return { origin, destination };
  }

  if (fallback && fallback.origin !== fallback.destination) {
    return fallback;
  }

  return { origin, destination };
}

function findNearestPointIndex(
  track: TrackPointInput[],
  center: { lat: number; lon: number }
): number {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < track.length; index += 1) {
    const point = track[index];
    const distance = haversineNm(point.lat, point.lon, center.lat, center.lon);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }
  return bestIndex;
}

function trackDistanceNm(track: TrackPointInput[]): number {
  let total = 0;
  for (let index = 1; index < track.length; index += 1) {
    const previous = track[index - 1];
    const current = track[index];
    total += haversineNm(previous.lat, previous.lon, current.lat, current.lon);
  }
  return total;
}

class MinHeap {
  private readonly items: HeapEntry[] = [];

  push(entry: HeapEntry): void {
    this.items.push(entry);
    this.bubbleUp(this.items.length - 1);
  }

  pop(): HeapEntry | undefined {
    if (this.items.length === 0) {
      return undefined;
    }
    const top = this.items[0];
    const tail = this.items.pop()!;
    if (this.items.length > 0) {
      this.items[0] = tail;
      this.bubbleDown(0);
    }
    return top;
  }

  get size(): number {
    return this.items.length;
  }

  private bubbleUp(startIndex: number): void {
    let index = startIndex;
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.items[parentIndex].distance <= this.items[index].distance) {
        break;
      }
      [this.items[parentIndex], this.items[index]] = [this.items[index], this.items[parentIndex]];
      index = parentIndex;
    }
  }

  private bubbleDown(startIndex: number): void {
    let index = startIndex;
    const lastIndex = this.items.length - 1;
    while (true) {
      const leftIndex = index * 2 + 1;
      const rightIndex = index * 2 + 2;
      let smallest = index;
      if (
        leftIndex <= lastIndex &&
        this.items[leftIndex].distance < this.items[smallest].distance
      ) {
        smallest = leftIndex;
      }
      if (
        rightIndex <= lastIndex &&
        this.items[rightIndex].distance < this.items[smallest].distance
      ) {
        smallest = rightIndex;
      }
      if (smallest === index) {
        break;
      }
      [this.items[smallest], this.items[index]] = [this.items[index], this.items[smallest]];
      index = smallest;
    }
  }
}

function rebuildTrackBySpatialContinuity(
  track: TrackPointInput[],
  origin: string,
  destination: string
): TrackPointInput[] {
  const originCenter = OBSERVED_PORT_CENTERS[origin as keyof typeof OBSERVED_PORT_CENTERS];
  const destinationCenter =
    OBSERVED_PORT_CENTERS[destination as keyof typeof OBSERVED_PORT_CENTERS];
  if (!originCenter || !destinationCenter || track.length < 3) {
    return track;
  }

  const cellSizeNm = 5;
  const maxRing = 20;
  const neighborCount = 16;
  const meanLat = average(track.map((point) => point.lat));
  const lonScale = 60 * Math.cos((meanLat * Math.PI) / 180);
  const projected = track.map((point, index) => ({
    index,
    x: point.lon * lonScale,
    y: point.lat * 60
  }));
  const grid = new Map<string, number[]>();
  const cellKey = (cellX: number, cellY: number) => `${cellX},${cellY}`;

  projected.forEach((point) => {
    const cellX = Math.floor(point.x / cellSizeNm);
    const cellY = Math.floor(point.y / cellSizeNm);
    const key = cellKey(cellX, cellY);
    const bucket = grid.get(key) ?? [];
    bucket.push(point.index);
    grid.set(key, bucket);
  });

  const adjacency = Array.from({ length: track.length }, () => [] as WeightedEdge[]);
  projected.forEach((point) => {
    const cellX = Math.floor(point.x / cellSizeNm);
    const cellY = Math.floor(point.y / cellSizeNm);
    const candidateSet = new Set<number>();
    for (let dx = -maxRing; dx <= maxRing; dx += 1) {
      for (let dy = -maxRing; dy <= maxRing; dy += 1) {
        const bucket = grid.get(cellKey(cellX + dx, cellY + dy));
        if (!bucket) {
          continue;
        }
        bucket.forEach((candidate) => {
          if (candidate !== point.index) {
            candidateSet.add(candidate);
          }
        });
      }
    }

    const nearest = [...candidateSet]
      .sort((left, right) => {
        const leftDx = projected[left].x - point.x;
        const leftDy = projected[left].y - point.y;
        const rightDx = projected[right].x - point.x;
        const rightDy = projected[right].y - point.y;
        return leftDx * leftDx + leftDy * leftDy - (rightDx * rightDx + rightDy * rightDy);
      })
      .slice(0, neighborCount);

    nearest.forEach((otherIndex) => {
      const weight = haversineNm(
        track[point.index].lat,
        track[point.index].lon,
        track[otherIndex].lat,
        track[otherIndex].lon
      );
      adjacency[point.index].push({ to: otherIndex, weight });
      adjacency[otherIndex].push({ to: point.index, weight });
    });
  });

  const startIndex = findNearestPointIndex(track, originCenter);
  const endIndex = findNearestPointIndex(track, destinationCenter);
  const distances = Array(track.length).fill(Number.POSITIVE_INFINITY);
  const visited = Array(track.length).fill(false);
  const heap = new MinHeap();
  distances[startIndex] = 0;
  heap.push({ index: startIndex, distance: 0 });

  while (heap.size > 0) {
    const current = heap.pop();
    if (!current || visited[current.index]) {
      continue;
    }
    visited[current.index] = true;
    adjacency[current.index].forEach((edge) => {
      const nextDistance = current.distance + edge.weight;
      if (nextDistance < distances[edge.to]) {
        distances[edge.to] = nextDistance;
        heap.push({ index: edge.to, distance: nextDistance });
      }
    });
  }

  const unreachable: number[] = [];
  const ordered = track
    .map((point, index) => ({ point, index, distance: distances[index] }))
    .filter((entry) => {
      if (Number.isFinite(entry.distance)) {
        return true;
      }
      unreachable.push(entry.index);
      return false;
    })
    .sort((left, right) => left.distance - right.distance)
    .map((entry) => entry.point);

  if (unreachable.length > 0) {
    const tail = unreachable
      .map((index) => track[index])
      .sort(
        (left, right) =>
          haversineNm(left.lat, left.lon, destinationCenter.lat, destinationCenter.lon) -
          haversineNm(right.lat, right.lon, destinationCenter.lat, destinationCenter.lon)
      );
    ordered.push(...tail);
  }

  const endDistance = distances[endIndex];
  if (!Number.isFinite(endDistance) || ordered.length !== track.length) {
    return track;
  }

  return ordered;
}

function normalizeTrackOrder(
  track: TrackPointInput[],
  origin: string,
  destination: string
): TrackPointInput[] {
  const orderedBySequence = [...track]
    .map((point, index) => ({ ...point, sequence: point.sequence ?? index }))
    .sort((left, right) => (left.sequence ?? 0) - (right.sequence ?? 0));

  const originCenter = OBSERVED_PORT_CENTERS[origin as keyof typeof OBSERVED_PORT_CENTERS];
  const destinationCenter =
    OBSERVED_PORT_CENTERS[destination as keyof typeof OBSERVED_PORT_CENTERS];
  if (!originCenter || !destinationCenter) {
    return orderedBySequence;
  }

  const directDistance = haversineNm(
    originCenter.lat,
    originCenter.lon,
    destinationCenter.lat,
    destinationCenter.lon
  );
  const orderedDistance = trackDistanceNm(orderedBySequence);
  if (orderedDistance <= directDistance * 2.5) {
    return orderedBySequence;
  }

  const rebuilt = rebuildTrackBySpatialContinuity(orderedBySequence, origin, destination);
  const rebuiltDistance = trackDistanceNm(rebuilt);
  return rebuiltDistance < orderedDistance * 0.7 ? rebuilt : orderedBySequence;
}

function sortUniqueDays(points: { day: string }[]): string[] {
  return [...new Set(points.map((point) => point.day))].sort((left, right) =>
    left.localeCompare(right)
  );
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
  // When we do not have an explicit shipping corridor, use the real sea route
  // itself as the reference geometry so the "ideal" line does not cut across land.
  return track.map((point) => [point.lon, point.lat]);
}

function buildVoyageFromTrack(input: BuildVoyageInput): DatasetVoyage {
  // Some cleaned AIS files contain routeId points that no longer follow a
  // spatially continuous order. Rebuild the route before generating geometry,
  // but keep timestamps themselves untouched for time-based metadata.
  const track =
    input.sourceType === "real"
      ? normalizeTrackOrder(input.track, input.origin, input.destination).map((point, index) => ({
          ...point,
          sequence: index
        }))
      : [...input.track]
          .map((point, index) => ({ ...point, sequence: point.sequence ?? index }))
          .sort((left, right) => (left.sequence ?? 0) - (right.sequence ?? 0));
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
  const fullSeries: EmissionSeriesPoint[] = track.map((point, index) => {
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
  const chronologicalTrack = [...track].sort((left, right) => left.ts.localeCompare(right.ts));
  const startDate = new Date(chronologicalTrack[0].ts);
  const endDate = new Date(chronologicalTrack[chronologicalTrack.length - 1].ts);
  const durationHours =
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
  const maxSpeed = Math.max(...track.map((point) => point.speed), 0);
  const avgSpeed = durationHours > 0 ? actualTotalDistance / durationHours : average(track.map((point) => point.speed));
  const totalEmission = fullSeries.reduce((sum, point) => sum + point.actualEmission, 0);
  const availableDays = sortUniqueDays(fullSeries);
  return {
    voyageId: input.voyageId,
    voyageIndex: input.voyageIndex,
    label: input.label,
    sourceType: input.sourceType,
    origin: input.origin,
    destination: input.destination,
    vesselId: input.vesselId,
    startTs: chronologicalTrack[0].ts,
    endTs: chronologicalTrack[chronologicalTrack.length - 1].ts,
    startDay: availableDays[0],
    endDay: availableDays[availableDays.length - 1],
    availableDays,
    emissionUnit: "score",
    bounds: computeBounds(actualRoute),
    actualRoute,
    referenceRoute,
    series: fullSeries,
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

export async function buildRealDataset(cleanedDataDir: string): Promise<RealDataset> {
  const files = (await readdir(cleanedDataDir))
    .filter((fileName) => fileName.toLowerCase().endsWith(".csv"))
    .map((fileName) => ({
      filePath: path.resolve(cleanedDataDir, fileName),
      ...parseRouteFromFilename(fileName)
    }))
    .sort((left, right) => left.fileKey.localeCompare(right.fileKey)) satisfies CleanedCsvFile[];

  if (files.length === 0) {
    throw new Error(`No CSV files found in ${cleanedDataDir}`);
  }

  const cleanedVessels = new Set<string>();
  const voyageRows = new Map<
    string,
    {
      vesselId: string;
      routeKey: string;
      fileKey: string;
      routeLine: string;
      points: TrackPointInput[];
    }
  >();
  let cleanedPointCount = 0;
  let cleanedFirst = "";
  let cleanedLast = "";

  for (const file of files) {
    await streamCsv<CleanRow>(file.filePath, (row) => {
      const routeId = row.routeId?.trim() || row.voyage_uuid?.trim();
      const rawTs = row.timestamp_new?.trim() || row.timestamp?.trim() || row.ts?.trim() || "";
      const ts = parseFlexibleTimestamp(rawTs);
      const lat = Number(row.latitude ?? row.lat);
      const lon = Number(row.longitude ?? row.lon);
      const speed = Number(row.speed ?? row.sog ?? 0);
      if (!routeId || !ts || Number.isNaN(lat) || Number.isNaN(lon)) {
        return;
      }

      cleanedPointCount += 1;
      if (row.mmsi) {
        cleanedVessels.add(row.mmsi);
      }
      if (!cleanedFirst || ts < cleanedFirst) {
        cleanedFirst = ts;
      }
      if (!cleanedLast || ts > cleanedLast) {
        cleanedLast = ts;
      }

      const voyageId = `${file.fileKey}-${routeId}`;
      const existing = voyageRows.get(voyageId) ?? {
        vesselId: row.mmsi || row.vesselName || voyageId,
        routeKey: file.fileKey,
        fileKey: file.fileKey,
        routeLine: row.route_line?.trim() ?? "",
        points: []
      };
      existing.points.push({
        sequence: cleanedPointCount,
        ts,
        lat,
        lon,
        speed,
        heading: row.heading ? Number(row.heading) : row.hdg ? Number(row.hdg) : null,
        cog: row.course ? Number(row.course) : row.cog ? Number(row.cog) : null
      });
      if (!existing.routeLine && row.route_line) {
        existing.routeLine = row.route_line.trim();
      }
      voyageRows.set(voyageId, existing);
    });
  }

  const orderedVoyages = [...voyageRows.entries()]
    .map(([voyageId, value]) => ({ voyageId, ...value }))
    .filter((voyage) => voyage.points.length > 1)
    .sort((left, right) => {
      const leftStart = [...left.points].sort((a, b) => a.ts.localeCompare(b.ts))[0]?.ts ?? "";
      const rightStart = [...right.points].sort((a, b) => a.ts.localeCompare(b.ts))[0]?.ts ?? "";
      return leftStart.localeCompare(rightStart);
    });

  const fileLevelRoutePairs = new Map<
    string,
    {
      origin: string;
      destination: string;
    }
  >();

  const voyagesByFile = new Map<string, typeof orderedVoyages>();
  for (const voyage of orderedVoyages) {
    const existing = voyagesByFile.get(voyage.fileKey) ?? [];
    existing.push(voyage);
    voyagesByFile.set(voyage.fileKey, existing);
  }

  for (const [fileKey, voyagesInFile] of voyagesByFile.entries()) {
    const startLabels = voyagesInFile.map((voyage) => {
      const orderedPoints = [...voyage.points].sort(
        (left, right) => (left.sequence ?? 0) - (right.sequence ?? 0)
      );
      return inferPortLabel(orderedPoints[0].lat, orderedPoints[0].lon);
    });
    const endLabels = voyagesInFile.map((voyage) => {
      const orderedPoints = [...voyage.points].sort(
        (left, right) => (left.sequence ?? 0) - (right.sequence ?? 0)
      );
      const lastPoint = orderedPoints[orderedPoints.length - 1];
      return inferPortLabel(lastPoint.lat, lastPoint.lon);
    });

    fileLevelRoutePairs.set(fileKey, {
      origin: majorityLabel(startLabels),
      destination: majorityLabel(endLabels)
    });
  }

  const classifiedVoyages = orderedVoyages.map((voyage) => {
    const fallbackPair = fileLevelRoutePairs.get(voyage.fileKey) ?? {
      origin: "Unknown",
      destination: "Unknown"
    };
    const firstPassPoints = normalizeTrackOrder(
      voyage.points,
      fallbackPair.origin,
      fallbackPair.destination
    );
    const inferredPair = inferPortPairFromTrack(firstPassPoints, fallbackPair);
    const normalizedPoints = normalizeTrackOrder(
      firstPassPoints,
      inferredPair.origin,
      inferredPair.destination
    ).map((point, index) => ({
      ...point,
      sequence: index
    }));
    return {
      ...voyage,
      routeKey: `${inferredPair.origin.toLowerCase()}-${inferredPair.destination.toLowerCase()}`,
      origin: inferredPair.origin,
      destination: inferredPair.destination,
      points: normalizedPoints
    };
  });

  const routeTracks = new Map<string, TrackPointInput[][]>();
  for (const voyage of classifiedVoyages) {
    const tracks = routeTracks.get(voyage.routeKey) ?? [];
    tracks.push(voyage.points);
    routeTracks.set(voyage.routeKey, tracks);
  }

  const corridorProfiles = new Map<string, number[]>();
  for (const [routeKey, tracks] of routeTracks.entries()) {
    corridorProfiles.set(routeKey, buildMedianProfile(tracks));
  }

  const corridorProfile = buildMedianProfile(classifiedVoyages.map((voyage) => voyage.points));
  const voyages = classifiedVoyages.map((voyage, index) =>
    buildVoyageFromTrack({
      voyageId: voyage.voyageId,
      voyageIndex: index + 1,
      label: `Real Voyage ${index + 1} (${voyage.origin}-${voyage.destination})`,
      sourceType: "real",
      origin: voyage.origin,
      destination: voyage.destination,
      vesselId: voyage.vesselId,
      track: voyage.points,
      referenceRoute:
        voyage.routeLine && voyage.routeLine.startsWith("LINESTRING")
          ? parseLineStringWkt(voyage.routeLine)
          : undefined,
      referenceSpeedProfile: corridorProfiles.get(voyage.routeKey)
    })
  );

  const rawSummary: RawSummary = {
    rawPointCount: cleanedPointCount,
    cleanedPointCount,
    rawUniqueVessels: cleanedVessels.size,
    cleanedUniqueVessels: cleanedVessels.size,
    voyageCount: voyages.length,
    rawDateRange: {
      start: cleanedFirst.slice(0, 10),
      end: cleanedLast.slice(0, 10)
    },
    cleanedDateRange: {
      start: cleanedFirst.slice(0, 10),
      end: cleanedLast.slice(0, 10)
    }
  };
  const meta: DatasetMeta = {
    generatedAt: new Date().toISOString(),
    latestDate: rawSummary.cleanedDateRange.end,
    timeRange: {
      startTs: cleanedFirst,
      endTs: cleanedLast
    },
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
        sequence: index,
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
