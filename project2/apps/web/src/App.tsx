import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { ENVIRONMENT_LAYER_LABELS } from "../../../shared/contracts";
import {
  getDashboardSnapshot,
  getEmissionSeries,
  getEnvironmentLayer,
  getMetrics,
  getPortPairVoyages,
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
import { TimeFilterStrip } from "./components/TimeFilterStrip";
import { WeightsPanel } from "./components/WeightsPanel";
import { cnNumber } from "./lib/format";
import { useDashboardStore } from "./store/dashboard-store";

const MAP_ENVIRONMENT_LAYERS = ["wind", "current"] as const;

export default function App() {
  const {
    timeFilter,
    envLayer,
    selectedVoyageId,
    selectedPortPair,
    selectedTimestamp,
    dataSource,
    initialized,
    setTimeFilter,
    setEnvLayer,
    setSelectedVoyageId,
    setSelectedPortPair,
    setSelectedTimestamp,
    setInitialized
  } = useDashboardStore();

  const snapshotQuery = useQuery({
    queryKey: ["snapshot", timeFilter?.startDay, timeFilter?.endDay],
    queryFn: () =>
      getDashboardSnapshot(timeFilter?.startDay, timeFilter?.endDay ?? timeFilter?.startDay)
  });

  useEffect(() => {
    if (!snapshotQuery.data || initialized) return;
    setTimeFilter(snapshotQuery.data.timeFilter);
    if (snapshotQuery.data.latestVoyageId) {
      setSelectedVoyageId(snapshotQuery.data.latestVoyageId, "real");
    }
    setInitialized(true);
  }, [
    initialized,
    setInitialized,
    setSelectedVoyageId,
    setTimeFilter,
    snapshotQuery.data
  ]);

  const pairVoyagesQuery = useQuery({
    queryKey: [
      "pair-voyages",
      selectedPortPair?.[0],
      selectedPortPair?.[1],
      timeFilter?.startDay,
      timeFilter?.endDay
    ],
    enabled: Boolean(selectedPortPair && timeFilter),
    queryFn: () => getPortPairVoyages(selectedPortPair![0], selectedPortPair![1], timeFilter!)
  });

  useEffect(() => {
    if (!selectedPortPair || !pairVoyagesQuery.data?.items.length) return;
    const first = pairVoyagesQuery.data.items[0];
    setSelectedVoyageId(first.voyageId, first.sourceType);
  }, [pairVoyagesQuery.data, selectedPortPair, setSelectedVoyageId]);

  const emissionSeriesQuery = useQuery({
    queryKey: ["emission-series", selectedVoyageId, timeFilter?.startDay, timeFilter?.endDay],
    enabled: Boolean(selectedVoyageId && timeFilter),
    queryFn: () => getEmissionSeries(selectedVoyageId!, timeFilter!)
  });

  const activeTs =
    selectedTimestamp ??
    emissionSeriesQuery.data?.points[0]?.ts ??
    `${timeFilter?.startDay ?? "2025-09-30"}T12:00:00+08:00`;

  const routeQuery = useQuery({
    queryKey: ["route", selectedVoyageId, timeFilter?.startDay, timeFilter?.endDay, activeTs],
    enabled: Boolean(selectedVoyageId && timeFilter),
    queryFn: () => getRoute(selectedVoyageId!, timeFilter!, activeTs)
  });

  const metricsQuery = useQuery({
    queryKey: ["metrics", selectedVoyageId, timeFilter?.startDay, timeFilter?.endDay],
    enabled: Boolean(selectedVoyageId && timeFilter),
    queryFn: () => getMetrics(selectedVoyageId!, timeFilter!)
  });

  const environmentQuery = useQuery({
    queryKey: ["environment-layer", envLayer, activeTs],
    enabled: Boolean(timeFilter),
    queryFn: () => getEnvironmentLayer(envLayer, activeTs)
  });

  useEffect(() => {
    if (!environmentQuery.isError || !timeFilter) return;
    void recordAnimationCheck({
      layer: envLayer,
      ok: false,
      reason:
        environmentQuery.error instanceof Error
          ? environmentQuery.error.message
          : "unknown",
      timeFilter,
      selectedVoyageId
    });
  }, [
    envLayer,
    environmentQuery.error,
    environmentQuery.isError,
    selectedVoyageId,
    timeFilter
  ]);

  const activePoint = useMemo(
    () =>
      emissionSeriesQuery.data?.points.find((point) => point.ts === selectedTimestamp) ??
      emissionSeriesQuery.data?.points[0] ??
      null,
    [emissionSeriesQuery.data?.points, selectedTimestamp]
  );

  if (snapshotQuery.isLoading || !snapshotQuery.data || !timeFilter) {
    return (
      <main className="app-shell loading-shell">
        <div className="hero">
          <h1>天津-青岛 AIS 可视化分析平台</h1>
          <p>正在装载预处理后的真实 AIS 数据与模拟扩展模块…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">AIS Visual Analytics WebApp</p>
          <h1>天津-青岛 AIS 航线优化可视化平台</h1>
          <p className="subhead">
            真实航次驱动主链路分析，标准航线由真实速度剖面推导，多港口网络与环境层由独立 mock 数据补齐。
          </p>
        </div>
        <div className="header-meta">
          <div className="header-chip">
            <span>Anchor Date</span>
            <strong>{snapshotQuery.data.anchorDate}</strong>
          </div>
          <div className="header-chip">
            <span>当前选中</span>
            <strong>{selectedVoyageId ?? "未选择"}</strong>
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
          <TimeFilterStrip
            anchorDate={snapshotQuery.data.anchorDate}
            value={timeFilter}
            onChange={setTimeFilter}
          />
          <div className="panel">
            <div className="panel-header">
              <h3>环境图层</h3>
              <p>地图环境场切换与动画自检</p>
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
          <ScatterPanel
            items={snapshotQuery.data.scatter}
            onSelect={(item) => setSelectedVoyageId(item.voyageId, item.sourceType)}
          />
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
              <p>交互与联动摘要</p>
            </div>
            <ul className="status-list">
              <li>航次数量：{snapshotQuery.data.scatter.length}</li>
              <li>
                时间窗口：{timeFilter.startDay} ~ {timeFilter.endDay ?? timeFilter.startDay}
              </li>
              <li>环境层：{ENVIRONMENT_LAYER_LABELS[envLayer]}</li>
              <li>当前累计差值：{cnNumber(activePoint?.deltaCumulative ?? 0)}</li>
              <li>
                港口对：
                {selectedPortPair
                  ? `${selectedPortPair[0]} → ${selectedPortPair[1]}`
                  : "未选择"}
              </li>
            </ul>
          </div>
        </aside>
      </section>
    </main>
  );
}
