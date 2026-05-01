import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { ENVIRONMENT_LAYER_LABELS } from "../../../shared/contracts";
import {
  getDashboardSnapshot,
  getEmissionSeries,
  getEnvironmentLayer,
  getMetrics,
  getRoute,
  recordAnimationCheck
} from "./lib/api";
import { Badge } from "./components/Badge";
import { ChordPanel } from "./components/ChordPanel";
import { DataCards } from "./components/DataCards";
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
    dataSource,
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

  const networkSummary = useMemo(() => {
    const ports = new Set(
      snapshotQuery.data?.portFlows.flatMap((flow) => [flow.source, flow.target]) ?? []
    );
    return {
      portCount: ports.size,
      flowCount: snapshotQuery.data?.portFlows.length ?? 0
    };
  }, [snapshotQuery.data?.portFlows]);

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
          <h1>多港口 AIS 航迹与排放可视化平台</h1>
          <p className="subhead">
            弦图始终保留全部港口和全部流向，散点图支持按起点港和终点港筛选。点击散点图中的单个航次点后，地图只显示这一条航次的实际 AIS 航迹和理想航线。
          </p>
        </div>
        <div className="header-meta">
          <div className="header-chip">
            <span>当前航次</span>
            <strong>{selectedVoyageId ?? "None"}</strong>
          </div>
          <div className="header-chip">
            <span>港口网络</span>
            <strong>
              {networkSummary.portCount} 个港口 / {networkSummary.flowCount} 条流向
            </strong>
          </div>
          {dataSource ? (
            <div className="header-chip">
              <span>数据来源</span>
              <Badge sourceType={dataSource} />
            </div>
          ) : null}
        </div>
      </header>

      <section className="dashboard-grid">
        <aside className="left-rail">
          <div className="panel">
            <div className="panel-header">
              <h3>环境图层</h3>
              <p>切换地图上的海洋环境辅助图层。</p>
            </div>
            <div className="env-switches">
              {MAP_ENVIRONMENT_LAYERS.map((layer) => (
                <button
                  key={layer}
                  type="button"
                  className={`env-pill ${envLayer === layer ? "active" : ""}`}
                  onClick={() => setEnvLayer(layer)}
                >
                  {ENVIRONMENT_LAYER_LABELS[layer]}
                </button>
              ))}
            </div>
          </div>
          <WeightsPanel snapshot={snapshotQuery.data} />
        </aside>

        <section className="center-stage">
          <MapPanel
            geometry={routeQuery.data ?? null}
            environment={environmentQuery.data ?? null}
            points={emissionSeriesQuery.data?.points ?? []}
            voyageSourceType={emissionSeriesQuery.data?.sourceType ?? null}
            environmentSourceType={environmentQuery.data?.sourceType ?? null}
            selectedTimestamp={selectedTimestamp}
            onSelectTimestamp={setSelectedTimestamp}
            layerLabel={ENVIRONMENT_LAYER_LABELS[envLayer]}
          />
          <SeriesPanels
            points={emissionSeriesQuery.data?.points ?? []}
            sourceType={emissionSeriesQuery.data?.sourceType ?? null}
            selectedTimestamp={selectedTimestamp}
            onHoverTimestamp={setSelectedTimestamp}
            onSelectTimestamp={setSelectedTimestamp}
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
          <DataCards cards={snapshotQuery.data.dataDescription} />
          <MetricsPanel metrics={metricsQuery.data ?? null} />
          <DetailPanel point={activePoint} />
          <div className="panel">
            <div className="panel-header">
              <h3>当前状态</h3>
              <p>当前筛选和联动结果摘要。</p>
            </div>
            <ul className="status-list">
              <li>当前航次数: {filteredScatter.length}</li>
              <li>环境图层: {ENVIRONMENT_LAYER_LABELS[envLayer]}</li>
              <li>累计排放差值: {cnNumber(activePoint?.deltaCumulative ?? 0)}</li>
              <li>
                港口对: {selectedPortPair ? `${selectedPortPair[0]} -> ${selectedPortPair[1]}` : "未选择"}
              </li>
            </ul>
          </div>
        </aside>
      </section>
      <section className="bottom-stage">
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
    </main>
  );
}
