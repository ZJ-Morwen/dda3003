import type { EChartsOption } from "echarts";
import type { SourceType } from "../../../../shared/contracts";
import type { EmissionSeriesPoint } from "../lib/api";
import { cnNumber } from "../lib/format";
import { Badge } from "./Badge";
import { EChart } from "./EChart";

interface SeriesPanelsProps {
  points: EmissionSeriesPoint[];
  sourceType: SourceType | null;
  selectedTimestamp: string | null;
  onHoverTimestamp: (timestamp: string | null) => void;
  onSelectTimestamp: (timestamp: string) => void;
}

function buildSeriesOption(
  points: EmissionSeriesPoint[],
  yName: string,
  actualKey: "actualEmission" | "actualSpeed",
  standardKey: "standardEmission" | "standardSpeed"
): EChartsOption {
  return {
    grid: { left: 50, right: 24, top: 28, bottom: 36 },
    tooltip: {
      trigger: "axis"
    },
    xAxis: {
      type: "category",
      data: points.map((point) => point.ts.slice(11, 16)),
      boundaryGap: false,
      axisLabel: { color: "#9cc0df" }
    },
    yAxis: {
      type: "value",
      name: yName,
      splitLine: { lineStyle: { color: "rgba(166,193,225,0.08)" } }
    },
    series: [
      {
        name: "Actual",
        type: "line",
        smooth: true,
        showSymbol: true,
        symbolSize: 6,
        data: points.map((point) => ({
          value: point[actualKey],
          ts: point.ts
        })),
        lineStyle: { color: "#ff8c5b", width: 2.5 },
        itemStyle: { color: "#ffb066" },
        areaStyle:
          actualKey === "actualEmission"
            ? { color: "rgba(255, 140, 91, 0.14)" }
            : undefined
      },
      {
        name: "Reference",
        type: "line",
        smooth: true,
        showSymbol: true,
        symbolSize: 6,
        data: points.map((point) => ({
          value: point[standardKey],
          ts: point.ts
        })),
        lineStyle: { color: "#47d0c9", width: 2, type: "dashed" },
        itemStyle: { color: "#86f4dd" }
      }
    ]
  };
}

export function SeriesPanels({
  points,
  sourceType,
  selectedTimestamp,
  onHoverTimestamp,
  onSelectTimestamp
}: SeriesPanelsProps) {
  const activePoint = points.find((point) => point.ts === selectedTimestamp) ?? points[0];

  const deltaOption: EChartsOption = {
    grid: { left: 50, right: 24, top: 28, bottom: 36 },
    tooltip: { trigger: "axis" },
    xAxis: {
      type: "category",
      data: points.map((point) => point.ts.slice(11, 16)),
      boundaryGap: false
    },
    yAxis: {
      type: "value",
      name: "Delta",
      splitLine: { lineStyle: { color: "rgba(166,193,225,0.08)" } }
    },
    series: [
      {
        type: "line",
        smooth: true,
        showSymbol: true,
        symbolSize: 6,
        lineStyle: { color: "#9f89ff", width: 2.5 },
        itemStyle: { color: "#c4b4ff" },
        data: points.map((point) => ({
          value: point.deltaCumulative,
          ts: point.ts
        })),
        markLine: {
          symbol: "none",
          lineStyle: {
            color: "rgba(255,255,255,0.25)",
            type: "dashed"
          },
          data: [{ yAxis: 0 }]
        }
      }
    ]
  };

  const commonEvents = {
    click: (params: unknown) => {
      const payload = params as { data?: { ts?: string } };
      if (payload.data?.ts) {
        onSelectTimestamp(payload.data.ts);
      }
    },
    mouseover: (params: unknown) => {
      const payload = params as { data?: { ts?: string } };
      onHoverTimestamp(payload.data?.ts ?? null);
    }
  };

  return (
    <div className="series-area">
      <div className="panel chart-panel">
        <div className="panel-header">
          <div>
            <h3>Emission Trend</h3>
            <p>Actual vs reference</p>
          </div>
          {sourceType ? <Badge sourceType={sourceType} /> : null}
        </div>
        <EChart
          className="chart small-chart"
          option={buildSeriesOption(points, "score", "actualEmission", "standardEmission")}
          onEvents={commonEvents}
        />
      </div>

      <div className="panel chart-panel">
        <div className="panel-header">
          <div>
            <h3>Speed Trend</h3>
            <p>Speed impact along the voyage</p>
          </div>
          {sourceType ? <Badge sourceType={sourceType} /> : null}
        </div>
        <EChart
          className="chart small-chart"
          option={buildSeriesOption(points, "kn", "actualSpeed", "standardSpeed")}
          onEvents={commonEvents}
        />
      </div>

      <div className="panel chart-panel">
        <div className="panel-header">
          <div>
            <h3>Cumulative Delta</h3>
            <p>Current point Δ={cnNumber(activePoint?.deltaCumulative ?? 0)}</p>
          </div>
          {sourceType ? <Badge sourceType={sourceType} /> : null}
        </div>
        <EChart className="chart small-chart" option={deltaOption} onEvents={commonEvents} />
      </div>
    </div>
  );
}
