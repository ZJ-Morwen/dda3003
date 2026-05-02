export type SourceType = "real" | "derived" | "mock";

export interface TimeFilter {
  mode: "instant" | "range";
  startTs: string;
  endTs?: string;
}

export interface ScatterItem {
  voyageId: string;
  voyageIndex: number;
  startTs: string;
  endTs: string;
  origin: string;
  destination: string;
  distanceNm: number;
  avgSpeed: number;
  totalEmission: number;
  emissionPerNm: number;
  emissionUnit: string;
  label?: string;
  sourceType: SourceType;
}

export interface EnvironmentWeights {
  wind: number;
  current: number;
  wave: number;
}

export interface VoyagePoint {
  ts: string;
  day: string;
  lat: number;
  lon: number;
  speed: number;
  heading: number | null;
  cog: number | null;
  progress: number;
  actualEmission: number;
  cumulativeActualEmission: number;
}

export interface EmissionSeriesPoint {
  ts: string;
  day: string;
  progress: number;
  lat: number;
  lon: number;
  refLat: number;
  refLon: number;
  actualSpeed: number;
  standardSpeed: number;
  actualEmission: number;
  standardEmission: number;
  deltaCumulative: number;
  sourceType: SourceType;
}

export interface RouteMetricsItem {
  metric: string;
  label: string;
  unit: string;
  actual: number;
  standard: number;
  delta: number;
}

export interface RouteMetrics {
  voyageId: string;
  sourceType: SourceType;
  items: RouteMetricsItem[];
  summary: {
    actualTotalEmission: number;
    standardTotalEmission: number;
    deltaEmission: number;
  };
}

export interface LineStringGeometry {
  type: "LineString";
  coordinates: [number, number][];
}

export interface RouteDisplayMetrics {
  label: string;
  distanceNm: number;
  avgSpeed: number;
  totalEmission: number;
  emissionPerNm: number;
  durationHours: number;
}

export interface BestRouteCandidate extends RouteDisplayMetrics {
  routeId: string;
  rank: number;
  sourceType: "derived";
  coordinates: [number, number][];
  reductionPercent: number;
  isRecommended: boolean;
}

export interface RouteGeometryPayload {
  voyageId: string;
  sourceType: SourceType;
  actualRoute: LineStringGeometry;
  referenceRoute: LineStringGeometry;
  actualMetrics?: RouteDisplayMetrics;
  bestRoutes?: BestRouteCandidate[];
  marker?: {
    ts: string;
    actual: [number, number];
    reference: [number, number];
  };
  bounds: [number, number, number, number];
}

export interface VoyageSummary {
  voyageId: string;
  voyageIndex: number;
  label: string;
  sourceType: SourceType;
  origin: string;
  destination: string;
  vesselId: string;
  startTs: string;
  endTs: string;
  startDay: string;
  endDay: string;
  availableDays: string[];
  emissionUnit: string;
  metrics: {
    durationHours: number;
    distanceNm: number;
    avgSpeed: number;
    maxSpeed: number;
    totalEmission: number;
    emissionPerNm: number;
  };
}

export interface PortFlow {
  source: string;
  target: string;
  value: number;
  sourceType: SourceType;
  description: string;
  voyageIds: string[];
}

export interface EnvironmentFieldVector {
  lon: number;
  lat: number;
  u: number;
  v: number;
  intensity: number;
}

export interface EnvironmentFieldPayload {
  layer: "wind" | "current" | "wave";
  ts: string;
  sourceType: SourceType;
  vectors: EnvironmentFieldVector[];
}

export interface DataDescriptionCard {
  title: string;
  value: string;
  detail: string;
  sourceType: SourceType;
}

export interface DashboardSnapshot {
  anchorDate: string;
  availableTimeRange: {
    startTs: string;
    endTs: string;
  };
  timeFilter: TimeFilter;
  scatter: ScatterItem[];
  weights: {
    weights: EnvironmentWeights;
    normalized: boolean;
    computedAt: string;
    sourceType: SourceType;
  };
  portFlows: PortFlow[];
  dataDescription: DataDescriptionCard[];
  latestVoyageId: string | null;
}

export interface AnimationCheckRecord {
  layer: "wind" | "current" | "wave";
  ok: boolean;
  reason?: string;
  timeFilter: TimeFilter;
  selectedVoyageId?: string | null;
  clientBuild?: string;
}

export interface MetaLatestDatePayload {
  latestDate: string;
  dateRange: {
    start: string;
    end: string;
  };
}

export const ENVIRONMENT_LAYER_LABELS: Record<"wind" | "current" | "wave", string> = {
  wind: "风场",
  current: "洋流",
  wave: "波浪"
};

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  real: "真实数据",
  derived: "推导数据",
  mock: "模拟数据"
};
