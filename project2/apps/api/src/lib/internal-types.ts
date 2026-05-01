import type { EmissionSeriesPoint, EnvironmentWeights, SourceType } from "../../../../shared/contracts.js";

export interface RouteMetricsSummary {
  durationHours: number;
  distanceNm: number;
  avgSpeed: number;
  maxSpeed: number;
  totalEmission: number;
  emissionPerNm: number;
}

export interface DatasetVoyage {
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
  bounds: [number, number, number, number];
  actualRoute?: [number, number][];
  referenceRoute?: [number, number][];
  series?: EmissionSeriesPoint[];
  metrics: RouteMetricsSummary;
}

export interface RawSummary {
  rawPointCount: number;
  cleanedPointCount: number;
  rawUniqueVessels: number;
  cleanedUniqueVessels: number;
  voyageCount: number;
  rawDateRange: {
    start: string;
    end: string;
  };
  cleanedDateRange: {
    start: string;
    end: string;
  };
}

export interface DatasetMeta {
  generatedAt: string;
  latestDate: string;
  timeRange: {
    startTs: string;
    endTs: string;
  };
  dateRange: {
    start: string;
    end: string;
  };
  rawSummary: RawSummary;
}

export interface RealDataset {
  meta: DatasetMeta;
  corridorProfile: number[];
  voyages: DatasetVoyage[];
}

export interface MockVoyageSeed {
  voyageId: string;
  label: string;
  source: string;
  target: string;
  startTs: string;
  intervalMinutes: number;
  coordinates: [number, number][];
  speeds: number[];
}

export interface PortFlowSeed {
  source: string;
  target: string;
  value: number;
  description: string;
}

export interface EnvironmentSeedFile {
  bounds: [number, number, number, number];
  layers: Record<
    "wind" | "current" | "wave",
    {
      biasX: number;
      biasY: number;
      frequency: number;
      amplitude: number;
      swirl: number;
      color: string;
    }
  >;
}

export interface EnvironmentWeightsPayloadInternal {
  weights: EnvironmentWeights;
  normalized: boolean;
  computedAt: string;
  sourceType: SourceType;
}

export interface CompositeDataset {
  real: RealDataset;
  mockVoyages: DatasetVoyage[];
  portFlowSeeds: PortFlowSeed[];
  environmentSeeds: EnvironmentSeedFile;
}
