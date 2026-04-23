import { existsSync } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
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
import { round } from "../lib/stats.js";
import { buildTimeFilter, dayInRange, ensureTimeFilter, normalizeDateInput, slidingWindowDays } from "../lib/time.js";

const ENVIRONMENT_LAYER_LABELS: Record<"wind" | "current" | "wave", string> = {
  wind: "风场",
  current: "洋流",
  wave: "波浪"
};

function resolveProjectRoot(): string {
  const candidates = [
    process.cwd(),
    path.resolve(process.cwd(), ".."),
    path.resolve(process.cwd(), "../.."),
    path.resolve(process.cwd(), "../../..")
  ];
  const match = candidates.find((candidate) =>
    existsSync(path.resolve(candidate, "data", "mock", "mock-voyage-seeds.json"))
  );
  return match ?? process.cwd();
}

const PROJECT_ROOT = resolveProjectRoot();
const GENERATED_DATA_PATH = path.resolve(
  PROJECT_ROOT,
  "data",
  "generated",
  "real-data.json"
);
const MOCK_VOYAGES_PATH = path.resolve(
  PROJECT_ROOT,
  "data",
  "mock",
  "mock-voyage-seeds.json"
);
const PORT_FLOW_SEEDS_PATH = path.resolve(
  PROJECT_ROOT,
  "data",
  "mock",
  "port-flow-seeds.json"
);
const ENVIRONMENT_SEEDS_PATH = path.resolve(
  PROJECT_ROOT,
  "data",
  "mock",
  "environment-seeds.json"
);
const CHECK_ANIMATION_PATH = path.resolve(
  PROJECT_ROOT,
  "data",
  "generated",
  "check-animation.json"
);

let datasetPromise: Promise<CompositeDataset> | null = null;

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
  if (!datasetPromise) {
    datasetPromise = loadDataset();
  }
  return datasetPromise;
}

function getSlice(series: EmissionSeriesPoint[], timeFilter: TimeFilter): EmissionSeriesPoint[] {
  const { startDay, endDay } = ensureTimeFilter(timeFilter);
  return series.filter((point) => dayInRange(point.day, startDay, endDay));
}

function summaryFromVoyage(voyage: DatasetVoyage, timeFilter: TimeFilter): VoyageSummary | null {
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
      totalEmission: summary.metrics.totalEmission,
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
    computedAt: `${endDay}T12:00:00+08:00`,
    sourceType: "mock"
  };
}

function buildPortFlows(dataset: CompositeDataset, timeFilter: TimeFilter): PortFlow[] {
  const realVoyages = dataset.real.voyages
    .filter((voyage) => getSlice(voyage.series, timeFilter).length > 0)
    .map((voyage) => voyage.voyageId);
  return dataset.portFlowSeeds.map((seed) => {
    if (seed.source === "Tianjin" && seed.target === "Qingdao") {
      return {
        source: seed.source,
        target: seed.target,
        value: realVoyages.length,
        sourceType: "real",
        description: "真实天津-青岛 AIS 航次流向统计。",
        voyageIds: realVoyages
      };
    }
    const mockVoyages = dataset.mockVoyages
      .filter(
        (voyage) =>
          voyage.origin === seed.source &&
          voyage.destination === seed.target &&
          getSlice(voyage.series, timeFilter).length > 0
      )
      .map((voyage) => voyage.voyageId);
    return {
      source: seed.source,
      target: seed.target,
      value: seed.value,
      sourceType: "mock",
      description: seed.description,
      voyageIds: mockVoyages
    };
  });
}

function buildDataDescription(dataset: CompositeDataset, timeFilter: TimeFilter): DataDescriptionCard[] {
  const range = ensureTimeFilter(timeFilter);
  return [
    {
      title: "AIS 原始点位",
      value: dataset.real.meta.rawSummary.rawPointCount.toLocaleString("zh-CN"),
      detail: `原始数据覆盖 ${dataset.real.meta.rawSummary.rawDateRange.start} 至 ${dataset.real.meta.rawSummary.rawDateRange.end}。`,
      sourceType: "real"
    },
    {
      title: "清洗后航次",
      value: dataset.real.meta.rawSummary.voyageCount.toString(),
      detail: `真实主链路使用天津-青岛 ${dataset.real.meta.rawSummary.voyageCount} 个有效航次。`,
      sourceType: "real"
    },
    {
      title: "标准航线模型",
      value: "中位速度剖面",
      detail: `基于真实航次速度分布推导标准参考线，当前时间窗 ${range.startDay} 至 ${range.endDay}。`,
      sourceType: "derived"
    },
    {
      title: "环境与多港流向",
      value: "模拟补齐",
      detail: "风场、洋流、波浪与非天津-青岛港口对使用独立 mock 数据目录生成。",
      sourceType: "mock"
    }
  ];
}

function buildRouteMetricsFromSlice(voyage: DatasetVoyage, timeFilter: TimeFilter): RouteMetrics | null {
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
      label: "总航行时间",
      unit: "小时",
      actual: round(durationHours, 3),
      standard: round(standardDuration, 3)
    },
    {
      metric: "distanceNm",
      label: "总距离",
      unit: "海里",
      actual: round(actualDistance, 3),
      standard: round(standardDistance, 3)
    },
    {
      metric: "avgSpeed",
      label: "平均速度",
      unit: "节",
      actual: round(durationHours > 0 ? actualDistance / durationHours : 0, 3),
      standard: round(standardDuration > 0 ? standardDistance / standardDuration : 0, 3)
    },
    {
      metric: "maxSpeed",
      label: "最大速度",
      unit: "节",
      actual: round(Math.max(...slice.map((point) => point.actualSpeed)), 3),
      standard: round(Math.max(...slice.map((point) => point.standardSpeed)), 3)
    },
    {
      metric: "totalEmission",
      label: "总碳排放分数",
      unit: "score",
      actual: round(actualTotalEmission, 3),
      standard: round(standardTotalEmission, 3)
    },
    {
      metric: "emissionPerNm",
      label: "单位距离排放",
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
  const slice = getSlice(voyage.series, timeFilter);
  if (slice.length === 0) {
    return null;
  }
  const markerPoint = ts
    ? slice.find((point) => point.ts === ts) ?? slice[0]
    : slice[0];
  const actualRoute = slice.map((point) => [point.lon, point.lat] as [number, number]);
  const referenceRoute = slice.map((point) => [point.refLon, point.refLat] as [number, number]);
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
    marker: {
      ts: markerPoint.ts,
      actual: [markerPoint.lon, markerPoint.lat],
      reference: [markerPoint.refLon, markerPoint.refLat]
    },
    bounds: computeBounds([...actualRoute, ...referenceRoute])
  };
}

function findVoyageById(dataset: CompositeDataset, voyageId: string): DatasetVoyage | undefined {
  return [...dataset.real.voyages, ...dataset.mockVoyages].find((voyage) => voyage.voyageId === voyageId);
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
  const latest = dataset.real.meta.latestDate;
  const startDay = normalizeDateInput(startDate, latest);
  const endDay = normalizeDateInput(endDate, startDay);
  const timeFilter = buildTimeFilter(startDay, endDay);
  const scatter = buildScatter(dataset.real.voyages, timeFilter);
  const latestVoyageId = scatter.length > 0 ? scatter[scatter.length - 1].voyageId : null;
  return {
    anchorDate: latest,
    timeFilter,
    scatter,
    weights: seededWeights(startDay, endDay),
    portFlows: buildPortFlows(dataset, timeFilter),
    dataDescription: buildDataDescription(dataset, timeFilter),
    latestVoyageId
  };
}

export async function getScatter(startDate?: string, endDate?: string): Promise<{ items: ScatterItem[]; startDate: string; endDate: string }> {
  const dataset = await getDataset();
  const latest = dataset.real.meta.latestDate;
  const startDay = normalizeDateInput(startDate, latest);
  const endDay = normalizeDateInput(endDate, startDay);
  return {
    items: buildScatter(dataset.real.voyages, buildTimeFilter(startDay, endDay)),
    startDate: startDay,
    endDate: endDay
  };
}

export async function getPortFlows(startDate?: string, endDate?: string): Promise<{ items: PortFlow[]; startDate: string; endDate: string }> {
  const dataset = await getDataset();
  const latest = dataset.real.meta.latestDate;
  const startDay = normalizeDateInput(startDate, latest);
  const endDay = normalizeDateInput(endDate, startDay);
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
  const latest = dataset.real.meta.latestDate;
  const timeFilter = buildTimeFilter(normalizeDateInput(startDate, latest), normalizeDateInput(endDate, startDate ?? latest));
  const pool =
    source === "Tianjin" && target === "Qingdao" ? dataset.real.voyages : dataset.mockVoyages;
  const items = pool
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
  const voyage = findVoyageById(dataset, voyageId);
  if (!voyage) {
    return null;
  }
  const latest = dataset.real.meta.latestDate;
  const timeFilter = buildTimeFilter(normalizeDateInput(startDate, latest), normalizeDateInput(endDate, startDate ?? latest));
  return buildRouteGeometry(voyage, timeFilter, ts);
}

export async function getVoyageEmissionSeries(
  voyageId: string,
  startDate?: string,
  endDate?: string
): Promise<{ voyageId: string; sourceType: DatasetVoyage["sourceType"]; points: EmissionSeriesPoint[] } | null> {
  const dataset = await getDataset();
  const voyage = findVoyageById(dataset, voyageId);
  if (!voyage) {
    return null;
  }
  const latest = dataset.real.meta.latestDate;
  const timeFilter = buildTimeFilter(normalizeDateInput(startDate, latest), normalizeDateInput(endDate, startDate ?? latest));
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
  const voyage = findVoyageById(dataset, voyageId);
  if (!voyage) {
    return null;
  }
  const latest = dataset.real.meta.latestDate;
  const timeFilter = buildTimeFilter(normalizeDateInput(startDate, latest), normalizeDateInput(endDate, startDate ?? latest));
  return buildRouteMetricsFromSlice(voyage, timeFilter);
}

export async function getEnvironmentWeights(
  startDate?: string,
  endDate?: string
): Promise<EnvironmentWeightsPayloadInternal> {
  const dataset = await getDataset();
  const latest = dataset.real.meta.latestDate;
  const startDay = normalizeDateInput(startDate, latest);
  const endDay = normalizeDateInput(endDate, startDay);
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
