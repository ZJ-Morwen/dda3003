import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  getDashboardSnapshot,
  getEmissionSeries,
  getEnvironmentLayer,
  getMetrics,
  getRoute,
  recordAnimationCheck
} from "./lib/api";
import { ChordPanel } from "./components/ChordPanel";
import { DetailPanel } from "./components/DetailPanel";
import { MapPanel } from "./components/MapPanel";
import { MetricsPanel } from "./components/MetricsPanel";
import { ScatterPanel } from "./components/ScatterPanel";
import { SeriesPanels } from "./components/SeriesPanels";
import { WeightsPanel } from "./components/WeightsPanel";
import { cnNumber } from "./lib/format";
import { useDashboardStore } from "./store/dashboard-store";

const MAP_ENVIRONMENT_LAYERS = ["wind", "current"] as const;

export default function App() {
  const [scatterOriginFilter, setScatterOriginFilter] = useState<string | null>(null);
  const [scatterDestinationFilter, setScatterDestinationFilter] = useState<string | null>(null);

  const {
    envLayer,
    selectedVoyageId,
    selectedPortPair,
    selectedTimestamp,
    setEnvLayer,
    setSelectedVoyageId,
    setSelectedPortPair,
    setSelectedTimestamp
  } = useDashboardStore();

  const snapshotQuery = useQuery({
    queryKey: ["snapshot"],
    queryFn: () => getDashboardSnapshot()
  });

  const emissionSeriesQuery = useQuery({
    queryKey: ["emission-series", selectedVoyageId],
    enabled: Boolean(selectedVoyageId),
    queryFn: () => getEmissionSeries(selectedVoyageId!)
  });

  const activeTs =
    selectedTimestamp ??
    emissionSeriesQuery.data?.points[0]?.ts ??
    null;
  const environmentTs =
    activeTs ??
    snapshotQuery.data?.availableTimeRange.startTs ??
    "2025-01-01T00:00:00.000Z";

  const routeQuery = useQuery({
    queryKey: ["route", selectedVoyageId, activeTs],
    enabled: Boolean(selectedVoyageId),
    queryFn: () => getRoute(selectedVoyageId!, { ts: activeTs ?? undefined })
  });

  const metricsQuery = useQuery({
    queryKey: ["metrics", selectedVoyageId],
    enabled: Boolean(selectedVoyageId),
    queryFn: () => getMetrics(selectedVoyageId!)
  });

  const environmentQuery = useQuery({
    queryKey: ["environment-layer", envLayer, environmentTs],
    enabled: Boolean(snapshotQuery.data),
    queryFn: () => getEnvironmentLayer(envLayer, environmentTs)
  });

  useEffect(() => {
    if (!environmentQuery.isError || !snapshotQuery.data) return;
    void recordAnimationCheck({
      layer: envLayer,
      ok: false,
      reason:
        environmentQuery.error instanceof Error
          ? environmentQuery.error.message
          : "unknown",
      timeFilter: snapshotQuery.data.timeFilter,
      selectedVoyageId
    });
  }, [
    envLayer,
    environmentQuery.error,
    environmentQuery.isError,
    selectedVoyageId,
    snapshotQuery.data
  ]);

  const activePoint = useMemo(
    () =>
      emissionSeriesQuery.data?.points.find((point) => point.ts === selectedTimestamp) ??
      emissionSeriesQuery.data?.points[0] ??
      null,
    [emissionSeriesQuery.data?.points, selectedTimestamp]
  );

  const scatterOriginOptions = useMemo(() => {
    const pool =
      snapshotQuery.data?.scatter.filter(
        (item) =>
          !scatterDestinationFilter || item.destination === scatterDestinationFilter
      ) ?? [];
    return [...new Set(pool.map((item) => item.origin))].sort((left, right) =>
      left.localeCompare(right)
    );
  }, [scatterDestinationFilter, snapshotQuery.data?.scatter]);

  const scatterDestinationOptions = useMemo(() => {
    const pool =
      snapshotQuery.data?.scatter.filter(
        (item) => !scatterOriginFilter || item.origin === scatterOriginFilter
      ) ?? [];
    return [...new Set(pool.map((item) => item.destination))].sort((left, right) =>
      left.localeCompare(right)
    );
  }, [scatterOriginFilter, snapshotQuery.data?.scatter]);

  const filteredScatter = useMemo(
    () =>
      snapshotQuery.data?.scatter.filter(
        (item) =>
          (!scatterOriginFilter || item.origin === scatterOriginFilter) &&
          (!scatterDestinationFilter || item.destination === scatterDestinationFilter)
      ) ?? [],
    [scatterDestinationFilter, scatterOriginFilter, snapshotQuery.data?.scatter]
  );

  useEffect(() => {
    if (!selectedPortPair) return;
    const [source, target] = selectedPortPair;
    setScatterOriginFilter((current) => (current === source ? current : source));
    setScatterDestinationFilter((current) => (current === target ? current : target));
  }, [selectedPortPair]);

  useEffect(() => {
    if (scatterOriginFilter && !scatterOriginOptions.includes(scatterOriginFilter)) {
      setScatterOriginFilter(null);
    }
  }, [scatterOriginFilter, scatterOriginOptions]);

  useEffect(() => {
    if (
      scatterDestinationFilter &&
      !scatterDestinationOptions.includes(scatterDestinationFilter)
    ) {
      setScatterDestinationFilter(null);
    }
  }, [scatterDestinationFilter, scatterDestinationOptions]);

  useEffect(() => {
    if (
      selectedVoyageId &&
      !filteredScatter.some((item) => item.voyageId === selectedVoyageId)
    ) {
      setSelectedVoyageId(null);
    }
  }, [filteredScatter, selectedVoyageId, setSelectedVoyageId]);

  useEffect(() => {
    if (scatterOriginFilter && scatterDestinationFilter) {
      if (
        selectedPortPair?.[0] !== scatterOriginFilter ||
        selectedPortPair?.[1] !== scatterDestinationFilter
      ) {
        setSelectedPortPair([scatterOriginFilter, scatterDestinationFilter]);
      }
      return;
    }
    if (selectedPortPair) {
      setSelectedPortPair(null);
    }
  }, [
    scatterDestinationFilter,
    scatterOriginFilter,
    selectedPortPair,
    setSelectedPortPair
  ]);

  if (snapshotQuery.isLoading || !snapshotQuery.data) {
    return (
      <main className="app-shell loading-shell">
        <div className="hero">
          <h1>AIS Visual Analytics</h1>
          <p>Loading full real AIS routes and linked visual analytics panels.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">AIS Visual Analytics WebApp</p>
          <h1>Multi-Port AIS Route and Emissions Visualization Platform</h1>
        </div>
      </header>

      <section className="top-stage">
        <ScatterPanel
          items={filteredScatter}
          totalCount={snapshotQuery.data.scatter.length}
          selectedVoyageId={selectedVoyageId}
          originFilter={scatterOriginFilter}
          destinationFilter={scatterDestinationFilter}
          originOptions={scatterOriginOptions}
          destinationOptions={scatterDestinationOptions}
          onChangeOriginFilter={setScatterOriginFilter}
          onChangeDestinationFilter={setScatterDestinationFilter}
          onSelect={(item) => setSelectedVoyageId(item.voyageId, item.sourceType)}
        />
      </section>

      <section className="dashboard-grid">
        <aside className="left-rail">
          <WeightsPanel snapshot={snapshotQuery.data} />
          <SeriesPanels
            points={emissionSeriesQuery.data?.points ?? []}
            selectedTimestamp={selectedTimestamp}
            onHoverTimestamp={setSelectedTimestamp}
            onSelectTimestamp={setSelectedTimestamp}
          />
        </aside>

        <section className="center-stage">
          <MapPanel
            geometry={routeQuery.data ?? null}
            environment={environmentQuery.data ?? null}
            points={emissionSeriesQuery.data?.points ?? []}
            selectedTimestamp={selectedTimestamp}
            onSelectTimestamp={setSelectedTimestamp}
            environmentLayers={MAP_ENVIRONMENT_LAYERS}
            currentEnvironmentLayer={envLayer}
            onChangeEnvironmentLayer={setEnvLayer}
          />
        </section>

        <aside className="right-rail">
          <ChordPanel
            flows={snapshotQuery.data.portFlows}
            selectedPortPair={selectedPortPair}
            onSelect={(flow) => {
              setSelectedPortPair([flow.source, flow.target]);
            }}
          />
          <DetailPanel point={activePoint} />
        </aside>
      </section>

      <section className="metrics-status-stage">
        <MetricsPanel metrics={metricsQuery.data ?? null} />
        <div className="panel status-panel">
          <div className="panel-header">
            <h3>Current Status</h3>
          </div>
          <div className="status-summary-grid">
            <div className="header-chip status-chip">
              <span>Port Pair</span>
              <strong>
                {selectedPortPair
                  ? `${selectedPortPair[0]} -> ${selectedPortPair[1]}`
                  : "Not selected"}
              </strong>
            </div>
            <div className="header-chip status-chip">
              <span>Current Voyage</span>
              <strong>{selectedVoyageId ?? "None"}</strong>
            </div>
            <div className="header-chip status-chip">
              <span>Current Voyage Count</span>
              <strong>{filteredScatter.length}</strong>
            </div>
            <div className="header-chip status-chip">
              <span>Cumulative Emission Delta</span>
              <strong>{cnNumber(activePoint?.deltaCumulative ?? 0)}</strong>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
