import type { EChartsOption } from "echarts";
import type { EmissionSeriesPoint } from "../lib/api";
import { cnFixedNumber, cnNumber } from "../lib/format";
import { EChart } from "./EChart";

interface SeriesPanelsProps {
  points: EmissionSeriesPoint[];
  selectedTimestamp: string | null;
  selectedTimeRange: { startTs: string; endTs: string } | null;
  pendingRangeStart: string | null;
  onSelectTimestamp: (timestamp: string) => void;
  onClearTimeRange: () => void;
}

function TrendLegend({
  actualLabel = "Real",
  referenceLabel = "Predicted",
  actualValue,
  referenceValue,
  digits = 4
}: {
  actualLabel?: string;
  referenceLabel?: string;
  actualValue?: number;
  referenceValue?: number;
  digits?: number;
}) {
  return (
    <div className="series-legend" aria-label="Trend legend">
      <span className="series-legend-item">
        <span className="series-legend-copy">
          <span className="series-legend-line series-legend-line-actual" />
          <span className="series-legend-label">{actualLabel}</span>
        </span>
        <span className="series-legend-value">
          {actualValue !== undefined ? cnFixedNumber(actualValue, digits) : "--"}
        </span>
      </span>
      <span className="series-legend-item">
        <span className="series-legend-copy">
          <span className="series-legend-line series-legend-line-reference" />
          <span className="series-legend-label">{referenceLabel}</span>
        </span>
        <span className="series-legend-value">
          {referenceValue !== undefined ? cnFixedNumber(referenceValue, digits) : "--"}
        </span>
      </span>
    </div>
  );
}

function roundTo(value: number, fractionDigits = 4): number {
  return Number(value.toFixed(fractionDigits));
}

function percentile(values: number[], ratio: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * ratio)));
  return sorted[index];
}

function trimEdgePoints(points: EmissionSeriesPoint[]): EmissionSeriesPoint[] {
  if (points.length <= 8) {
    return points;
  }

  const bodyStart = Math.floor(points.length * 0.15);
  const bodyEnd = Math.ceil(points.length * 0.85);
  const interior = points.slice(bodyStart, bodyEnd);
  const interiorValues = interior.flatMap((point) => [
    point.actualEmission,
    point.standardEmission
  ]);
  const median = percentile(interiorValues, 0.5);
  const baseline = percentile(interiorValues, 0.85);
  const threshold = Math.max(baseline * 1.8, median + 120);
  const stabilityWindow = Math.min(4, Math.max(2, Math.floor(points.length / 20)));

  let start = 0;
  let end = points.length;

  for (let index = 0; index <= points.length - stabilityWindow; index += 1) {
    const window = points.slice(index, index + stabilityWindow);
    const windowPeak = Math.max(
      ...window.flatMap((point) => [point.actualEmission, point.standardEmission])
    );
    const windowAverage =
      window.reduce(
        (sum, point) => sum + point.actualEmission + point.standardEmission,
        0
      ) /
      (window.length * 2);

    if (windowPeak <= threshold && windowAverage <= threshold * 0.75) {
      start = index;
      break;
    }
  }

  for (let index = points.length; index >= stabilityWindow; index -= 1) {
    const window = points.slice(index - stabilityWindow, index);
    const windowPeak = Math.max(
      ...window.flatMap((point) => [point.actualEmission, point.standardEmission])
    );
    const windowAverage =
      window.reduce(
        (sum, point) => sum + point.actualEmission + point.standardEmission,
        0
      ) /
      (window.length * 2);

    if (windowPeak <= threshold && windowAverage <= threshold * 0.75) {
      end = index;
      break;
    }
  }

  return end - start >= 4 ? points.slice(start, end) : points;
}

function samplePoints(points: EmissionSeriesPoint[], maxPoints = 64): EmissionSeriesPoint[] {
  if (points.length <= maxPoints) {
    return points;
  }

  const bucketSize = points.length / maxPoints;
  const sampled: EmissionSeriesPoint[] = [];

  for (let index = 0; index < maxPoints; index += 1) {
    const start = Math.floor(index * bucketSize);
    const end = Math.min(points.length, Math.floor((index + 1) * bucketSize));
    const bucket = points.slice(start, Math.max(start + 1, end));
    const lastPoint = bucket[bucket.length - 1] ?? points[start];

    const average = <K extends keyof EmissionSeriesPoint>(key: K): number =>
      bucket.reduce((sum, point) => sum + Number(point[key]), 0) / bucket.length;

    sampled.push({
      ...lastPoint,
      actualSpeed: roundTo(average("actualSpeed")),
      standardSpeed: roundTo(average("standardSpeed")),
      actualEmission: roundTo(average("actualEmission")),
      standardEmission: roundTo(average("standardEmission")),
      deltaCumulative: lastPoint.deltaCumulative
    });
  }

  return sampled;
}

function getChartPoints(points: EmissionSeriesPoint[]): EmissionSeriesPoint[] {
  return samplePoints(trimEdgePoints(points));
}

function findClosestPoint(points: EmissionSeriesPoint[], selectedTimestamp: string | null): EmissionSeriesPoint | null {
  if (!selectedTimestamp || points.length === 0) {
    return null;
  }

  const target = new Date(selectedTimestamp).getTime();
  return points.reduce((closest, point) => {
    const pointTime = new Date(point.ts).getTime();
    if (!closest) {
      return point;
    }
    const closestTime = new Date(closest.ts).getTime();
    return Math.abs(pointTime - target) < Math.abs(closestTime - target) ? point : closest;
  }, null as EmissionSeriesPoint | null);
}

function findRangeIndexes(
  points: EmissionSeriesPoint[],
  selectedTimeRange: { startTs: string; endTs: string } | null
): [number, number] | null {
  if (!selectedTimeRange || points.length === 0) {
    return null;
  }

  const start = points.findIndex((point) => point.ts === selectedTimeRange.startTs);
  const end = points.findIndex((point) => point.ts === selectedTimeRange.endTs);
  if (start < 0 || end < 0) {
    return null;
  }

  return start <= end ? [start, end] : [end, start];
}

function buildRangeMarkArea(
  points: EmissionSeriesPoint[],
  selectedTimeRange: { startTs: string; endTs: string } | null
) {
  const indexes = findRangeIndexes(points, selectedTimeRange);
  if (!indexes) {
    return undefined;
  }

  const [startIndex, endIndex] = indexes;
  return {
    silent: true,
    itemStyle: {
      color: "rgba(255, 228, 107, 0.10)"
    },
    data: [[{ xAxis: startIndex }, { xAxis: endIndex }]] as [
      [{ xAxis: number }, { xAxis: number }]
    ]
  };
}

function buildSelectionMarkPoint(
  point: EmissionSeriesPoint | null,
  value: number,
  color: string,
  digits = 2,
  position:
    | "top"
    | "bottom"
    | "left"
    | "right"
    | "insideTop"
    | "insideBottom" = "bottom",
  labelPrefix?: string
) {
  if (!point) {
    return undefined;
  }

  return {
    symbol: "circle",
    symbolSize: 14,
    itemStyle: {
      color,
      borderColor: "#f2fbff",
      borderWidth: 2
    },
    label: {
      show: true,
      formatter: `${labelPrefix ? `${labelPrefix} ` : ""}${cnNumber(value, digits)}`,
      color: "#f2fbff",
      backgroundColor: `${color}22`,
      borderColor: color,
      borderWidth: 1,
      borderRadius: 6,
      padding: [3, 6],
      position,
      offset:
        position === "top"
          ? [0, -16]
          : position === "bottom"
            ? [0, 42]
            : position === "left"
              ? [-16, 0]
              : position === "right"
                ? [16, 0]
                : position === "insideTop"
                  ? [0, -8]
                  : [0, 8]
    },
    data: [{ name: point.ts, coord: [point.ts.slice(11, 16), value] }]
  };
}

function buildSpeedOption(
  points: EmissionSeriesPoint[],
  selectedTimestamp: string | null,
  selectedTimeRange: { startTs: string; endTs: string } | null
): EChartsOption {
  const chartPoints = getChartPoints(points);
  const selectedPoint = findClosestPoint(chartPoints, selectedTimestamp);
  const markArea = buildRangeMarkArea(chartPoints, selectedTimeRange);
  const speedValues = chartPoints.flatMap((point) => [point.actualSpeed, point.standardSpeed]);
  const rawMin = Math.min(...speedValues);
  const rawMax = Math.max(...speedValues);
  const range = Math.max(rawMax - rawMin, 1);
  const padding = Math.max(range * 0.18, 1.5);
  const yMin = Math.max(0, rawMin - padding);
  const yMax = rawMax + padding;

  return {
    grid: { left: 50, right: 24, top: 28, bottom: 36 },
    tooltip: {
      trigger: "axis",
      valueFormatter: (value) =>
        typeof value === "number" ? value.toFixed(4) : String(value)
    },
    xAxis: {
      type: "category",
      data: chartPoints.map((point) => point.ts.slice(11, 16)),
      boundaryGap: false,
      axisLabel: { color: "#9cc0df" }
    },
    yAxis: {
      type: "value",
      name: "kn",
      min: yMin,
      max: yMax,
      splitLine: { lineStyle: { color: "rgba(166,193,225,0.08)" } }
    },
    series: [
      {
        name: "Reference",
        type: "line",
        smooth: false,
        showSymbol: true,
        symbolSize: 6,
        data: chartPoints.map((point) => ({
          value: point.standardSpeed,
          ts: point.ts,
          symbolSize: point.ts === selectedPoint?.ts ? 10 : 6,
          itemStyle:
            point.ts === selectedPoint?.ts
              ? {
                  color: "#86f4dd",
                  borderColor: "#f2fbff",
                  borderWidth: 2
                }
              : undefined
        })),
        lineStyle: { color: "#47d0c9", width: 2, type: "dashed" },
        itemStyle: { color: "#86f4dd" },
        areaStyle: { opacity: 0 },
        markArea,
        z: 3
      },
      {
        name: "Actual",
        type: "line",
        smooth: false,
        showSymbol: true,
        symbolSize: 6,
        data: chartPoints.map((point) => ({
          value: point.actualSpeed,
          ts: point.ts,
          symbolSize: point.ts === selectedPoint?.ts ? 10 : 6,
          itemStyle:
            point.ts === selectedPoint?.ts
              ? {
                  color: "#ffb066",
                  borderColor: "#f2fbff",
                  borderWidth: 2
                }
              : undefined
        })),
        lineStyle: { color: "#ff8c5b", width: 2.5 },
        itemStyle: { color: "#ffb066" },
        areaStyle: { opacity: 0 },
        z: 4
      }
    ]
  };
}

function buildSeriesOption(
  points: EmissionSeriesPoint[],
  yName: string,
  actualKey: "actualEmission" | "actualSpeed",
  standardKey: "standardEmission" | "standardSpeed",
  selectedTimestamp: string | null,
  selectedTimeRange: { startTs: string; endTs: string } | null
): EChartsOption {
  const displayPoints = getChartPoints(points);
  const selectedPoint = findClosestPoint(displayPoints, selectedTimestamp);
  const markArea = buildRangeMarkArea(displayPoints, selectedTimeRange);
  const values = displayPoints.flatMap((point) => [
    Number(point[actualKey]),
    Number(point[standardKey])
  ]);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const range = Math.max(rawMax - rawMin, 1);
  const padding = Math.max(range * 0.18, actualKey === "actualEmission" ? 15 : 1.5);
  const yMin = Math.max(0, rawMin - padding);
  const yMax = rawMax + padding;

  return {
    grid: { left: 50, right: 24, top: 28, bottom: 36 },
    tooltip: {
      trigger: "axis"
    },
    xAxis: {
      type: "category",
      data: displayPoints.map((point) => point.ts.slice(11, 16)),
      boundaryGap: false,
      axisLabel: { color: "#9cc0df" }
    },
    yAxis: {
      type: "value",
      name: yName,
      min: yMin,
      max: yMax,
      splitLine: { lineStyle: { color: "rgba(166,193,225,0.08)" } }
    },
    series: [
      {
        name: "Actual",
        type: "line",
        smooth: true,
        showSymbol: true,
        symbolSize: 6,
        data: displayPoints.map((point) => ({
          value: point[actualKey],
          ts: point.ts,
          symbolSize: point.ts === selectedPoint?.ts ? 10 : 6,
          itemStyle:
            point.ts === selectedPoint?.ts
              ? {
                  color: "#ffb066",
                  borderColor: "#f2fbff",
                  borderWidth: 2
                }
              : undefined
        })),
        lineStyle: { color: "#ff8c5b", width: 2.5 },
        itemStyle: { color: "#ffb066" },
        markArea,
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
        data: displayPoints.map((point) => ({
          value: point[standardKey],
          ts: point.ts,
          symbolSize: point.ts === selectedPoint?.ts ? 10 : 6,
          itemStyle:
            point.ts === selectedPoint?.ts
              ? {
                  color: "#86f4dd",
                  borderColor: "#f2fbff",
                  borderWidth: 2
                }
              : undefined
        })),
        lineStyle: { color: "#47d0c9", width: 2, type: "dashed" },
        itemStyle: { color: "#86f4dd" }
      }
    ]
  };
}

export function SeriesPanels({
  points,
  selectedTimestamp,
  selectedTimeRange,
  pendingRangeStart,
  onSelectTimestamp,
  onClearTimeRange
}: SeriesPanelsProps) {
  const chartPoints = getChartPoints(points);
  const defaultChartPoint = chartPoints[0] ?? points[0] ?? null;
  const selectedChartPoint = findClosestPoint(chartPoints, selectedTimestamp) ?? defaultChartPoint;
  const deltaSelectedPoint = findClosestPoint(chartPoints, selectedTimestamp) ?? defaultChartPoint;
  const cumulativePoints = chartPoints.map((point, index) => ({
    ...point,
    actualCumulative:
      chartPoints
        .slice(0, index + 1)
        .reduce((sum, entry) => sum + entry.actualEmission, 0),
    referenceCumulative:
      chartPoints
        .slice(0, index + 1)
        .reduce((sum, entry) => sum + entry.standardEmission, 0)
  }));
  const selectedCumulativePoint =
    cumulativePoints.find((point) => point.ts === deltaSelectedPoint?.ts) ?? null;
  const currentDisplayedGap = selectedCumulativePoint
    ? selectedCumulativePoint.actualCumulative - selectedCumulativePoint.referenceCumulative
    : 0;

  const deltaOption: EChartsOption = {
    grid: { left: 50, right: 24, top: 28, bottom: 36 },
    tooltip: {
      trigger: "axis",
      valueFormatter: (value) =>
        typeof value === "number" ? value.toFixed(4) : String(value)
    },
    xAxis: {
      type: "category",
      data: chartPoints.map((point) => point.ts.slice(11, 16)),
      boundaryGap: false
    },
    yAxis: {
      type: "value",
      name: "Cumulative Emission Index",
      splitLine: { lineStyle: { color: "rgba(166,193,225,0.08)" } }
    },
    series: [
      {
        name: "Reference",
        type: "line",
        smooth: true,
        showSymbol: true,
        symbolSize: 6,
        lineStyle: { color: "#47d0c9", width: 2, type: "dashed" },
        itemStyle: { color: "#86f4dd" },
        markArea: buildRangeMarkArea(chartPoints, selectedTimeRange),
        data: cumulativePoints.map((point) => ({
          value: point.referenceCumulative,
          ts: point.ts,
          symbolSize: point.ts === deltaSelectedPoint?.ts ? 10 : 6,
          itemStyle:
            point.ts === deltaSelectedPoint?.ts
              ? {
                  color: "#86f4dd",
                  borderColor: "#f2fbff",
                  borderWidth: 2
                }
              : undefined
        }))
      },
      {
        name: "Actual",
        type: "line",
        smooth: true,
        showSymbol: true,
        symbolSize: 6,
        lineStyle: { color: "#9f89ff", width: 2.5 },
        itemStyle: { color: "#c4b4ff" },
        data: cumulativePoints.map((point) => ({
          value: point.actualCumulative,
          ts: point.ts,
          symbolSize: point.ts === deltaSelectedPoint?.ts ? 10 : 6,
          itemStyle:
            point.ts === deltaSelectedPoint?.ts
              ? {
                  color: "#c4b4ff",
                  borderColor: "#f2fbff",
                  borderWidth: 2
                }
              : undefined
        }))
      }
    ]
  };

  const commonEvents = {
    click: (params: unknown) => {
      const payload = params as { data?: { ts?: string } };
      if (payload.data?.ts) {
        onSelectTimestamp(payload.data.ts);
      }
    }
  };

  const rangeStatus = selectedTimeRange
    ? `Interval ${selectedTimeRange.startTs.slice(11, 16)} - ${selectedTimeRange.endTs.slice(11, 16)}`
    : pendingRangeStart
      ? `Start ${pendingRangeStart.slice(11, 16)}, click another point to finish`
      : "Click two points to highlight a time interval on the map.";

  return (
    <div className="series-area">
      <div className="panel chart-panel">
        <div className="panel-header">
          <div className="series-header-block">
            <div className="series-title-row">
              <h3>Emission Trend</h3>
              <button
                type="button"
                className="range-clear-button"
                onClick={onClearTimeRange}
                disabled={!selectedTimeRange && !pendingRangeStart}
              >
                Clear Range
              </button>
            </div>
            <p>Actual vs reference emission index over time</p>
            <TrendLegend
              actualLabel="Real"
              referenceLabel="Predicted"
              actualValue={selectedChartPoint?.actualEmission}
              referenceValue={selectedChartPoint?.standardEmission}
              digits={2}
            />
            <div className="series-range-status">{rangeStatus}</div>
          </div>
        </div>
        <EChart
          className="chart small-chart"
          option={buildSeriesOption(
            points,
            "Emission Index",
            "actualEmission",
            "standardEmission",
            selectedTimestamp,
            selectedTimeRange
          )}
          onEvents={commonEvents}
        />
      </div>

      <div className="panel chart-panel">
        <div className="panel-header">
          <div className="series-header-block">
            <h3>Speed Trend</h3>
            <p>Speed impact along the voyage</p>
            <TrendLegend
              actualLabel="Real"
              referenceLabel="Predicted"
              actualValue={selectedChartPoint?.actualSpeed}
              referenceValue={selectedChartPoint?.standardSpeed}
              digits={4}
            />
          </div>
        </div>
        <EChart
          className="chart small-chart"
          option={buildSpeedOption(points, selectedTimestamp, selectedTimeRange)}
          onEvents={commonEvents}
        />
      </div>

      <div className="panel chart-panel">
        <div className="panel-header">
          <div className="series-header-block">
            <h3>Cumulative Emission Index</h3>
            <p>Current gap: {cnNumber(currentDisplayedGap, 4)}</p>
            <TrendLegend
              actualLabel="Real cumulative"
              referenceLabel="Predicted cumulative"
              actualValue={
                selectedCumulativePoint?.actualCumulative
              }
              referenceValue={
                selectedCumulativePoint?.referenceCumulative
              }
              digits={4}
            />
          </div>
        </div>
        <EChart className="chart small-chart" option={deltaOption} onEvents={commonEvents} />
      </div>
    </div>
  );
}
