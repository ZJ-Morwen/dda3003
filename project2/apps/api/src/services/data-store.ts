import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  DashboardSnapshot,
  DataDescriptionCard,
  EmissionSeriesPoint,
  EnvironmentFieldPayload,
  MetaLatestDatePayload,
  PortFlow,
  RouteGeometryPayload,
  RouteMetrics,
  ScatterItem,
  TimeFilter,
  VoyageSummary
} from "../../../../shared/contracts.js";
import {
  buildMockVoyages,
  readJsonFile,
  type MockVoyageSeed,
  type PortFlowSeed
} from "../lib/build-dataset.js";
import { computeBounds, haversineNm } from "../lib/geo.js";
import type {
  CompositeDataset,
  DatasetVoyage,
  EnvironmentSeedFile,
  EnvironmentWeightsPayloadInternal,
  RealDataset
} from "../lib/internal-types.js";
import { projectPath } from "../lib/project-paths.js";
import { round } from "../lib/stats.js";
import { buildTimeFilter, ensureTimeFilter, normalizeTimeInput, slidingWindowDays, timestampInRange } from "../lib/time.js";

const ENVIRONMENT_LAYER_LABELS: Record<"wind" | "current" | "wave", string> = {
  wind: "Wind",
  current: "Current",
  wave: "Wave"
};

const GENERATED_DATA_PATH = projectPath(
  "data",
  "generated",
  "real-data.json"
);
const GENERATED_VOYAGES_DIR = projectPath(
  "data",
  "generated",
  "voyages"
);
const MOCK_VOYAGES_PATH = projectPath(
  "data",
  "mock",
  "mock-voyage-seeds.json"
);
const PORT_FLOW_SEEDS_PATH = projectPath(
  "data",
  "mock",
  "port-flow-seeds.json"
);
const ENVIRONMENT_SEEDS_PATH = projectPath(
  "data",
  "mock",
  "environment-seeds.json"
);
const CHECK_ANIMATION_PATH = projectPath(
  "data",
  "generated",
  "check-animation.json"
);

let datasetPromise: Promise<CompositeDataset> | null = null;
let datasetVersion = "";

function getDatasetTimeRange(real: RealDataset): { startTs: string; endTs: string } {
  return (
    real.meta.timeRange ?? {
      startTs: `${real.meta.dateRange.start}T00:00:00.000Z`,
      endTs: `${real.meta.dateRange.end}T23:59:59.999Z`
    }
  );
}

async function ensureDiagnosticsFile(): Promise<void> {
  await mkdir(path.dirname(CHECK_ANIMATION_PATH), { recursive: true });
  try {
    await access(CHECK_ANIMATION_PATH);
  } catch {
    await writeFile(CHECK_ANIMATION_PATH, "[]\n", "utf8");
  }
}

async function loadDataset(): Promise<CompositeDataset> {
  const real = await readJsonFile<RealDataset>(GENERATED_DATA_PATH);
  const mockSeeds = await readJsonFile<MockVoyageSeed[]>(MOCK_VOYAGES_PATH);
  const portFlowSeeds = await readJsonFile<PortFlowSeed[]>(PORT_FLOW_SEEDS_PATH);
  const environmentSeeds = await readJsonFile<EnvironmentSeedFile>(ENVIRONMENT_SEEDS_PATH);
  return {
    real,
    mockVoyages: buildMockVoyages(mockSeeds, real.voyages.length),
    portFlowSeeds,
    environmentSeeds
  };
}

async function getDataset(): Promise<CompositeDataset> {
  const nextVersion = `${(await stat(GENERATED_DATA_PATH)).mtimeMs}`;
  if (!datasetPromise || datasetVersion !== nextVersion) {
    datasetVersion = nextVersion;
    datasetPromise = loadDataset();
  }
  return datasetPromise;
}

function getSlice(series: EmissionSeriesPoint[], timeFilter: TimeFilter): EmissionSeriesPoint[] {
  const { startTs, endTs } = ensureTimeFilter(timeFilter);
  return series.filter((point) => timestampInRange(point.ts, startTs, endTs));
}

function voyageIntersectsTimeFilter(voyage: DatasetVoyage, timeFilter: TimeFilter): boolean {
  const { startTs, endTs } = ensureTimeFilter(timeFilter);
  return (
    timestampInRange(voyage.startTs, startTs, endTs) ||
    timestampInRange(voyage.endTs, startTs, endTs) ||
    (voyage.startTs <= startTs && voyage.endTs >= endTs)
  );
}

async function loadRealVoyageDetail(voyageId: string): Promise<DatasetVoyage | null> {
  const filePath = path.resolve(GENERATED_VOYAGES_DIR, `${voyageId}.json`);
  try {
    return await readJsonFile<DatasetVoyage>(filePath);
  } catch {
    return null;
  }
}

function summaryFromVoyage(voyage: DatasetVoyage, timeFilter: TimeFilter): VoyageSummary | null {
  if (!voyageIntersectsTimeFilter(voyage, timeFilter)) {
    return null;
  }
  if (!voyage.series) {
    return {
      voyageId: voyage.voyageId,
      voyageIndex: voyage.voyageIndex,
      label: voyage.label,
      sourceType: voyage.sourceType,
      origin: voyage.origin,
      destination: voyage.destination,
      vesselId: voyage.vesselId,
      startTs: voyage.startTs,
      endTs: voyage.endTs,
      startDay: voyage.startDay,
      endDay: voyage.endDay,
      availableDays: voyage.availableDays,
      emissionUnit: voyage.emissionUnit,
      metrics: voyage.metrics
    };
  }
  const slice = getSlice(voyage.series, timeFilter);
  if (slice.length === 0) {
    return null;
  }
  const first = slice[0];
  const last = slice[slice.length - 1];
  const actualRoute = slice.map((point) => [point.lon, point.lat] as [number, number]);
  let distanceNm = 0;
  for (let index = 1; index < actualRoute.length; index += 1) {
    const [prevLon, prevLat] = actualRoute[index - 1];
    const [lon, lat] = actualRoute[index];
    distanceNm += haversineNm(prevLat, prevLon, lat, lon);
  }
  const totalEmission = slice.reduce((sum, point) => sum + point.actualEmission, 0);
  const startTs = first.ts;
  const endTs = last.ts;
  const durationHours =
    (new Date(endTs).getTime() - new Date(startTs).getTime()) / (1000 * 60 * 60);
  return {
    voyageId: voyage.voyageId,
    voyageIndex: voyage.voyageIndex,
    label: voyage.label,
    sourceType: voyage.sourceType,
    origin: voyage.origin,
    destination: voyage.destination,
    vesselId: voyage.vesselId,
    startTs,
    endTs,
    startDay: first.day,
    endDay: last.day,
    availableDays: [...new Set(slice.map((point) => point.day))],
    emissionUnit: voyage.emissionUnit,
    metrics: {
      durationHours: round(durationHours, 3),
      distanceNm: round(distanceNm, 3),
      avgSpeed: round(
        durationHours > 0
          ? distanceNm / durationHours
          : slice.reduce((sum, point) => sum + point.actualSpeed, 0) / slice.length,
        3
      ),
      maxSpeed: round(Math.max(...slice.map((point) => point.actualSpeed)), 3),
      totalEmission: round(totalEmission, 3),
      emissionPerNm: round(totalEmission / (distanceNm || 1), 3)
    }
  };
}

function buildScatter(voyages: DatasetVoyage[], timeFilter: TimeFilter): ScatterItem[] {
  return voyages
    .map((voyage) => summaryFromVoyage(voyage, timeFilter))
    .filter((voyage): voyage is VoyageSummary => Boolean(voyage))
    .sort((left, right) => left.startTs.localeCompare(right.startTs))
    .map((summary, index) => ({
      voyageId: summary.voyageId,
      voyageIndex: index + 1,
      startTs: summary.startTs,
      endTs: summary.endTs,
      origin: summary.origin,
      destination: summary.destination,
      distanceNm: summary.metrics.distanceNm,
      avgSpeed: summary.metrics.avgSpeed,
      totalEmission: summary.metrics.totalEmission,
      emissionPerNm: summary.metrics.emissionPerNm,
      emissionUnit: summary.emissionUnit,
      label: summary.label,
      sourceType: summary.sourceType
    }));
}

function seededWeights(startDay: string, endDay: string): EnvironmentWeightsPayloadInternal {
  const key = `${startDay}:${endDay}`;
  const phase = [...key].reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 3), 0);
  const raw = {
    wind: 0.48 + 0.11 * Math.sin(phase / 17),
    current: 0.31 + 0.08 * Math.cos(phase / 29),
    wave: 0.21 + 0.06 * Math.sin(phase / 13 + 1.1)
  };
  const safe = {
    wind: Math.max(0.05, raw.wind),
    current: Math.max(0.05, raw.current),
    wave: Math.max(0.05, raw.wave)
  };
  const total = safe.wind + safe.current + safe.wave;
  return {
    weights: {
      wind: round(safe.wind / total, 3),
      current: round(safe.current / total, 3),
      wave: round(safe.wave / total, 3)
    },
    normalized: true,
    computedAt: endDay,
    sourceType: "mock"
  };
}

function buildPortFlows(dataset: CompositeDataset, timeFilter: TimeFilter): PortFlow[] {
  const grouped = new Map<string, PortFlow>();
  for (const voyage of dataset.real.voyages) {
    if (!voyageIntersectsTimeFilter(voyage, timeFilter)) {
      continue;
    }
    const key = `${voyage.origin}-->${voyage.destination}`;
    const existing = grouped.get(key) ?? {
      source: voyage.origin,
      target: voyage.destination,
      value: 0,
      sourceType: "real" as const,
      description: `Real AIS voyages from ${voyage.origin} to ${voyage.destination}.`,
      voyageIds: []
    };
    existing.value += 1;
    existing.voyageIds.push(voyage.voyageId);
    grouped.set(key, existing);
  }
  return [...grouped.values()].sort((left, right) => right.value - left.value);
}

function buildDataDescription(dataset: CompositeDataset, timeFilter: TimeFilter): DataDescriptionCard[] {
  const uniqueRoutes = new Set(
    dataset.real.voyages.map((voyage) => `${voyage.origin}-${voyage.destination}`)
  ).size;
  return [
    {
      title: "AIS Raw Points",
      value: dataset.real.meta.rawSummary.rawPointCount.toLocaleString("zh-CN"),
      detail: `Covers ${dataset.real.meta.rawSummary.rawDateRange.start} to ${dataset.real.meta.rawSummary.rawDateRange.end}.`,
      sourceType: "real"
    },
    {
      title: "Real Voyages",
      value: dataset.real.meta.rawSummary.voyageCount.toString(),
      detail: `${dataset.real.meta.rawSummary.voyageCount} voyages across ${uniqueRoutes} real port pairs from cleaned_ais_data.`,
      sourceType: "real"
    },
    {
      title: "Reference Route Model",
      value: "Median speed profile",
      detail: "Derived from real voyages grouped by origin and destination ports.",
      sourceType: "derived"
    },
    {
      title: "Environment Layers",
      value: "Mock assisted",
      detail: "Wind, current, and wave layers remain synthetic support layers for visualization.",
      sourceType: "mock"
    }
  ];
}

function buildRouteMetricsFromSlice(voyage: DatasetVoyage, timeFilter: TimeFilter): RouteMetrics | null {
  if (!voyage.series) {
    return null;
  }
  const slice = getSlice(voyage.series, timeFilter);
  if (slice.length === 0) {
    return null;
  }
  let actualDistance = 0;
  let standardDistance = 0;
  for (let index = 1; index < slice.length; index += 1) {
    const prev = slice[index - 1];
    const current = slice[index];
    actualDistance += haversineNm(prev.lat, prev.lon, current.lat, current.lon);
    standardDistance += haversineNm(prev.refLat, prev.refLon, current.refLat, current.refLon);
  }
  const actualTotalEmission = slice.reduce((sum, point) => sum + point.actualEmission, 0);
  const standardTotalEmission = slice.reduce((sum, point) => sum + point.standardEmission, 0);
  const startTs = slice[0].ts;
  const endTs = slice[slice.length - 1].ts;
  const durationHours =
    (new Date(endTs).getTime() - new Date(startTs).getTime()) / (1000 * 60 * 60);
  const standardDuration = slice.slice(1).reduce((sum, point, index) => {
    const previous = slice[index];
    const distance = haversineNm(previous.refLat, previous.refLon, point.refLat, point.refLon);
    return sum + distance / Math.max(point.standardSpeed, 0.1);
  }, 0);
  const items = [
    {
      metric: "durationHours",
      label: "Duration",
      unit: "h",
      actual: round(durationHours, 3),
      standard: round(standardDuration, 3)
    },
    {
      metric: "distanceNm",
      label: "Distance",
      unit: "NM",
      actual: round(actualDistance, 3),
      standard: round(standardDistance, 3)
    },
    {
      metric: "avgSpeed",
      label: "Average speed",
      unit: "kt",
      actual: round(durationHours > 0 ? actualDistance / durationHours : 0, 3),
      standard: round(standardDuration > 0 ? standardDistance / standardDuration : 0, 3)
    },
    {
      metric: "maxSpeed",
      label: "Max speed",
      unit: "kt",
      actual: round(Math.max(...slice.map((point) => point.actualSpeed)), 3),
      standard: round(Math.max(...slice.map((point) => point.standardSpeed)), 3)
    },
    {
      metric: "totalEmission",
      label: "Total emission score",
      unit: "score",
      actual: round(actualTotalEmission, 3),
      standard: round(standardTotalEmission, 3)
    },
    {
      metric: "emissionPerNm",
      label: "Emission per NM",
      unit: "score/NM",
      actual: round(actualTotalEmission / (actualDistance || 1), 3),
      standard: round(standardTotalEmission / (standardDistance || 1), 3)
    }
  ].map((item) => ({
    ...item,
    delta: round(item.actual - item.standard, 3)
  }));
  return {
    voyageId: voyage.voyageId,
    sourceType: voyage.sourceType,
    items,
    summary: {
      actualTotalEmission: round(actualTotalEmission, 3),
      standardTotalEmission: round(standardTotalEmission, 3),
      deltaEmission: round(actualTotalEmission - standardTotalEmission, 3)
    }
  };
}

function buildRouteGeometry(voyage: DatasetVoyage, timeFilter: TimeFilter, ts?: string): RouteGeometryPayload | null {
  if (!voyage.series) {
    return null;
  }
  const slice = getSlice(voyage.series, timeFilter);
  if (slice.length === 0) {
    return null;
  }
  const markerPoint = ts
    ? slice.find((point) => point.ts === ts) ?? slice[0]
    : slice[0];
  const actualRoute = slice.map((point) => [point.lon, point.lat] as [number, number]);
  const referenceRoute = slice.map((point) => [point.refLon, point.refLat] as [number, number]);
  let actualDistance = 0;
  for (let index = 1; index < actualRoute.length; index += 1) {
    const [prevLon, prevLat] = actualRoute[index - 1];
    const [lon, lat] = actualRoute[index];
    actualDistance += haversineNm(prevLat, prevLon, lat, lon);
  }
  const actualTotalEmission = slice.reduce((sum, point) => sum + point.actualEmission, 0);
  const durationHours =
    (new Date(slice[slice.length - 1].ts).getTime() - new Date(slice[0].ts).getTime()) /
    (1000 * 60 * 60);
  const bestRoutes = voyage.bestRoutes ?? [];
  const bestRouteCoordinates = bestRoutes.flatMap((route) => route.coordinates);
  return {
    voyageId: voyage.voyageId,
    sourceType: voyage.sourceType,
    actualRoute: {
      type: "LineString",
      coordinates: actualRoute
    },
    referenceRoute: {
      type: "LineString",
      coordinates: referenceRoute
    },
    actualMetrics: {
      label: "Actual AIS Route",
      distanceNm: round(actualDistance, 3),
      avgSpeed: round(durationHours > 0 ? actualDistance / durationHours : 0, 3),
      durationHours: round(durationHours, 3),
      totalEmission: round(actualTotalEmission, 3),
      emissionPerNm: round(actualTotalEmission / (actualDistance || 1), 3)
    },
    bestRoutes,
    marker: {
      ts: markerPoint.ts,
      actual: [markerPoint.lon, markerPoint.lat],
      reference: [markerPoint.refLon, markerPoint.refLat]
    },
    bounds: computeBounds([...actualRoute, ...referenceRoute, ...bestRouteCoordinates])
  };
}

function findVoyageById(dataset: CompositeDataset, voyageId: string): DatasetVoyage | undefined {
  return [...dataset.real.voyages, ...dataset.mockVoyages].find((voyage) => voyage.voyageId === voyageId);
}

async function loadVoyageForDetail(dataset: CompositeDataset, voyageId: string): Promise<DatasetVoyage | undefined> {
  const mockVoyage = dataset.mockVoyages.find((voyage) => voyage.voyageId === voyageId);
  if (mockVoyage) {
    return mockVoyage;
  }
  return (await loadRealVoyageDetail(voyageId)) ?? findVoyageById(dataset, voyageId);
}

export async function getMetaLatestDate(): Promise<MetaLatestDatePayload> {
  const dataset = await getDataset();
  return {
    latestDate: dataset.real.meta.latestDate,
    dateRange: dataset.real.meta.dateRange
  };
}

export async function getDashboardSnapshot(
  startDate?: string,
  endDate?: string
): Promise<DashboardSnapshot> {
  const dataset = await getDataset();
  const { startTs: minTs, endTs: maxTs } = getDatasetTimeRange(dataset.real);
  const startTs = normalizeTimeInput(startDate, minTs);
  const endTs = normalizeTimeInput(endDate, maxTs);
  const timeFilter = buildTimeFilter(startTs, endTs);
  const scatter = buildScatter(dataset.real.voyages, timeFilter);
  const latestVoyageId = scatter.length > 0 ? scatter[scatter.length - 1].voyageId : null;
  return {
    anchorDate: dataset.real.meta.latestDate,
    availableTimeRange: getDatasetTimeRange(dataset.real),
    timeFilter,
    scatter,
    weights: seededWeights(startTs, endTs),
    portFlows: buildPortFlows(dataset, timeFilter),
    dataDescription: buildDataDescription(dataset, timeFilter),
    latestVoyageId
  };
}

export async function getScatter(startDate?: string, endDate?: string): Promise<{ items: ScatterItem[]; startDate: string; endDate: string }> {
  const dataset = await getDataset();
  const { startTs: minTs, endTs: maxTs } = getDatasetTimeRange(dataset.real);
  const startDay = normalizeTimeInput(startDate, minTs);
  const endDay = normalizeTimeInput(endDate, maxTs);
  return {
    items: buildScatter(dataset.real.voyages, buildTimeFilter(startDay, endDay)),
    startDate: startDay,
    endDate: endDay
  };
}

export async function getPortFlows(startDate?: string, endDate?: string): Promise<{ items: PortFlow[]; startDate: string; endDate: string }> {
  const dataset = await getDataset();
  const { startTs: minTs, endTs: maxTs } = getDatasetTimeRange(dataset.real);
  const startDay = normalizeTimeInput(startDate, minTs);
  const endDay = normalizeTimeInput(endDate, maxTs);
  return {
    items: buildPortFlows(dataset, buildTimeFilter(startDay, endDay)),
    startDate: startDay,
    endDate: endDay
  };
}

export async function getPortFlowVoyages(
  source: string,
  target: string,
  startDate?: string,
  endDate?: string
): Promise<{ source: string; target: string; items: VoyageSummary[] }> {
  const dataset = await getDataset();
  const { startTs: minTs, endTs: maxTs } = getDatasetTimeRange(dataset.real);
  const timeFilter = buildTimeFilter(normalizeTimeInput(startDate, minTs), normalizeTimeInput(endDate, maxTs));
  const items = dataset.real.voyages
    .filter((voyage) => voyage.origin === source && voyage.destination === target)
    .map((voyage) => summaryFromVoyage(voyage, timeFilter))
    .filter((voyage): voyage is VoyageSummary => Boolean(voyage));
  return { source, target, items };
}

export async function getVoyageRoute(
  voyageId: string,
  startDate?: string,
  endDate?: string,
  ts?: string
): Promise<RouteGeometryPayload | null> {
  const dataset = await getDataset();
  const voyage = await loadVoyageForDetail(dataset, voyageId);
  if (!voyage) {
    return null;
  }
  const { startTs: minTs, endTs: maxTs } = getDatasetTimeRange(dataset.real);
  const timeFilter = buildTimeFilter(normalizeTimeInput(startDate, minTs), normalizeTimeInput(endDate, maxTs));
  return buildRouteGeometry(voyage, timeFilter, ts);
}

export async function getVoyageEmissionSeries(
  voyageId: string,
  startDate?: string,
  endDate?: string
): Promise<{ voyageId: string; sourceType: DatasetVoyage["sourceType"]; points: EmissionSeriesPoint[] } | null> {
  const dataset = await getDataset();
  const voyage = await loadVoyageForDetail(dataset, voyageId);
  if (!voyage) {
    return null;
  }
  const { startTs: minTs, endTs: maxTs } = getDatasetTimeRange(dataset.real);
  const timeFilter = buildTimeFilter(normalizeTimeInput(startDate, minTs), normalizeTimeInput(endDate, maxTs));
  if (!voyage.series) {
    return null;
  }
  return {
    voyageId,
    sourceType: voyage.sourceType,
    points: getSlice(voyage.series, timeFilter)
  };
}

export async function getVoyageMetrics(
  voyageId: string,
  startDate?: string,
  endDate?: string
): Promise<RouteMetrics | null> {
  const dataset = await getDataset();
  const voyage = await loadVoyageForDetail(dataset, voyageId);
  if (!voyage) {
    return null;
  }
  const { startTs: minTs, endTs: maxTs } = getDatasetTimeRange(dataset.real);
  const timeFilter = buildTimeFilter(normalizeTimeInput(startDate, minTs), normalizeTimeInput(endDate, maxTs));
  return buildRouteMetricsFromSlice(voyage, timeFilter);
}

export async function getEnvironmentWeights(
  startDate?: string,
  endDate?: string
): Promise<EnvironmentWeightsPayloadInternal> {
  const dataset = await getDataset();
  const { startTs: minTs, endTs: maxTs } = getDatasetTimeRange(dataset.real);
  const startDay = normalizeTimeInput(startDate, minTs);
  const endDay = normalizeTimeInput(endDate, maxTs);
  return seededWeights(startDay, endDay);
}

export async function getEnvironmentLayer(
  layer: "wind" | "current" | "wave",
  ts: string
): Promise<EnvironmentFieldPayload> {
  const dataset = await getDataset();
  const config = dataset.environmentSeeds.layers[layer];
  const [minLon, minLat, maxLon, maxLat] = dataset.environmentSeeds.bounds;
  const width = 12;
  const height = 8;
  const phase = new Date(ts).getTime() / 3_600_000;
  const vectors = Array.from({ length: width * height }, (_, index) => {
    const x = index % width;
    const y = Math.floor(index / width);
    const lon = minLon + ((maxLon - minLon) * x) / (width - 1);
    const lat = minLat + ((maxLat - minLat) * y) / (height - 1);
    const angle =
      config.frequency * (x / width + y / height + phase * 0.05) +
      config.swirl * Math.sin(phase * 0.1 + y * 0.7);
    const intensity =
      config.amplitude *
      (0.55 + 0.45 * Math.sin(phase * 0.08 + x * 0.6 - y * 0.4));
    return {
      lon: round(lon, 4),
      lat: round(lat, 4),
      u: round((config.biasX + Math.cos(angle)) * intensity, 4),
      v: round((config.biasY + Math.sin(angle)) * intensity, 4),
      intensity: round(Math.abs(intensity), 4)
    };
  });
  return {
    layer,
    ts,
    sourceType: "mock",
    vectors
  };
}

export async function recordAnimationCheck(payload: Record<string, unknown>): Promise<void> {
  await ensureDiagnosticsFile();
  const raw = await readFile(CHECK_ANIMATION_PATH, "utf8");
  const entries = JSON.parse(raw) as Record<string, unknown>[];
  entries.push({
    ...payload,
    recordedAt: new Date().toISOString()
  });
  await writeFile(CHECK_ANIMATION_PATH, JSON.stringify(entries, null, 2), "utf8");
}

export async function getDefaultWindowDays(): Promise<string[]> {
  const dataset = await getDataset();
  return slidingWindowDays(dataset.real.meta.latestDate, 7);
}

export async function getEnvironmentLegend(): Promise<{ layer: string; label: string }[]> {
  return Object.entries(ENVIRONMENT_LAYER_LABELS).map(([layer, label]) => ({ layer, label }));
}
