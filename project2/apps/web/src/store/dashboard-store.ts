import { create } from "zustand";

import type { SourceType, TimeFilter } from "../../../../shared/contracts";

interface DashboardState {
  timeFilter: TimeFilter | null;
  envLayer: "wind" | "current" | "wave";
  selectedVoyageId: string | null;
  selectedPortPair: [string, string] | null;
  selectedTimestamp: string | null;
  dataSource: SourceType | null;
  initialized: boolean;
  setTimeFilter: (timeFilter: TimeFilter) => void;
  setEnvLayer: (layer: "wind" | "current" | "wave") => void;
  setSelectedVoyageId: (voyageId: string | null, sourceType?: SourceType | null) => void;
  setSelectedPortPair: (pair: [string, string] | null) => void;
  setSelectedTimestamp: (timestamp: string | null) => void;
  setInitialized: (value: boolean) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  timeFilter: null,
  envLayer: "wind",
  selectedVoyageId: null,
  selectedPortPair: null,
  selectedTimestamp: null,
  dataSource: null,
  initialized: false,
  setTimeFilter: (timeFilter) =>
    set({
      timeFilter,
      selectedVoyageId: null,
      selectedTimestamp: null,
      selectedPortPair: null,
      dataSource: null
    }),
  setEnvLayer: (envLayer) => set({ envLayer }),
  setSelectedVoyageId: (selectedVoyageId, dataSource = null) =>
    set({
      selectedVoyageId,
      dataSource,
      selectedTimestamp: null
    }),
  setSelectedPortPair: (selectedPortPair) => set({ selectedPortPair }),
  setSelectedTimestamp: (selectedTimestamp) => set({ selectedTimestamp }),
  setInitialized: (initialized) => set({ initialized })
}));
