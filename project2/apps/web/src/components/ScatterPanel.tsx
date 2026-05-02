import type { EChartsOption } from "echarts";

import type { ScatterItem } from "../lib/api";
import { EChart } from "./EChart";

interface ScatterPanelProps {
  items: ScatterItem[];
  totalCount: number;
  selectedVoyageId: string | null;
  originFilter: string | null;
  destinationFilter: string | null;
  originOptions: string[];
  destinationOptions: string[];
  onChangeOriginFilter: (value: string | null) => void;
  onChangeDestinationFilter: (value: string | null) => void;
  onSelect: (item: ScatterItem) => void;
}

function routeLabel(item: ScatterItem): string {
  return `${item.origin} -> ${item.destination}`;
}

function xJitter(index: number): number {
  return ((index % 13) - 6) * 0.065;
}

function yJitter(index: number): number {
  return ((Math.floor(index / 5) % 9) - 4) * 0.45;
}

export function ScatterPanel({
  items,
  totalCount,
  selectedVoyageId,
  originFilter,
  destinationFilter,
  originOptions,
  destinationOptions,
  onChangeOriginFilter,
  onChangeDestinationFilter,
  onSelect
}: ScatterPanelProps) {
  const routeKeys = [...new Set(items.map((item) => routeLabel(item)))].sort((left, right) =>
    left.localeCompare(right)
  );
  const routeIndex = new Map(routeKeys.map((key, index) => [key, index]));
  const palette = [
    "#7ac7ff",
    "#7bf0b4",
    "#ffc86a",
    "#ff8e72",
    "#df91ff",
    "#9fe870",
    "#f6b5d8"
  ];
  const routeColor = new Map(
    routeKeys.map((key, index) => [key, palette[index % palette.length]])
  );
  const yValues = items.map((item) => item.emissionPerNm);
  const yMin = yValues.length > 0 ? Math.min(...yValues) - 3 : 0;
  const yMax = yValues.length > 0 ? Math.max(...yValues) + 3 : 100;

  const option: EChartsOption = {
    grid: { left: 60, right: 24, top: 32, bottom: 78 },
    tooltip: {
      trigger: "item",
      formatter: (params: unknown) => {
        const payload = params as { data?: { item?: ScatterItem } };
        const item = payload.data?.item;
        if (!item) {
          return "";
        }
        return [
          routeLabel(item),
          `Voyage: ${item.voyageId}`,
          `Emission intensity: ${item.emissionPerNm.toFixed(2)} score/NM`,
          `Total emission: ${item.totalEmission.toFixed(2)} ${item.emissionUnit}`,
          `Distance: ${item.distanceNm.toFixed(2)} NM`
        ].join("<br/>");
      }
    },
    xAxis: {
      name: "Port pair",
      type: "value",
      min: -0.6,
      max: Math.max(routeKeys.length - 0.4, 0.6),
      interval: 1,
      axisLabel: {
        color: "#a8c6e1",
        rotate: 18,
        formatter: (value: number) => routeKeys[Math.round(value)] ?? ""
      },
      axisLine: { lineStyle: { color: "#6b87a4" } },
      splitLine: { show: false }
    },
    yAxis: {
      name: "Emission intensity (score/NM)",
      type: "value",
      min: yMin,
      max: yMax,
      scale: true,
      axisLine: { lineStyle: { color: "#6b87a4" } },
      splitLine: { lineStyle: { color: "rgba(166, 193, 225, 0.1)" } }
    },
    series: [
      {
        type: "scatter",
        cursor: "pointer",
        symbolSize: (_value: number[], params: { dataIndex: number }) => {
          const item = items[params.dataIndex];
          return item?.voyageId === selectedVoyageId ? 14 : 8;
        },
        data: items.map((item, index) => {
          const key = routeLabel(item);
          return {
            value: [
              (routeIndex.get(key) ?? 0) + xJitter(index),
              item.emissionPerNm + yJitter(index)
            ],
            voyageId: item.voyageId,
            item,
            itemStyle: {
              color: routeColor.get(key),
              opacity: item.voyageId === selectedVoyageId ? 1 : 0.72
            }
          };
        })
      }
    ]
  };

  return (
    <div className="panel chart-panel">
      <div className="panel-header">
        <div>
          <h3>Voyage Emissions Scatter Plot</h3>
          <p>
            Filter by origin and destination, then click a voyage point to show only that vessel's actual and ideal routes on the map.
          </p>
        </div>
        <div className="scatter-toolbar">
          <button
            type="button"
            className="scatter-reset"
            onClick={() => {
              onChangeOriginFilter(null);
              onChangeDestinationFilter(null);
            }}
            disabled={!originFilter && !destinationFilter}
          >
            Clear Filters
          </button>
        </div>
      </div>
      <div className="scatter-layout">
        <div className="scatter-side">
          <div className="scatter-filters">
            <label className="scatter-filter">
              <span>Origin Port</span>
              <select
                value={originFilter ?? ""}
                onChange={(event) => onChangeOriginFilter(event.target.value || null)}
              >
                <option value="">All origins</option>
                {originOptions.map((origin) => (
                  <option key={origin} value={origin}>
                    {origin}
                  </option>
                ))}
              </select>
            </label>
            <label className="scatter-filter">
              <span>Destination Port</span>
              <select
                value={destinationFilter ?? ""}
                onChange={(event) =>
                  onChangeDestinationFilter(event.target.value || null)
                }
              >
                <option value="">All destinations</option>
                {destinationOptions.map((destination) => (
                  <option key={destination} value={destination}>
                    {destination}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="scatter-side-card">
            <strong>
              {originFilter ?? "All origins"} {"->"} {destinationFilter ?? "All destinations"}
            </strong>
            <div className="scatter-count">
              {items.length} / {totalCount} voyages
            </div>
          </div>
        </div>
        <div className="scatter-chart-area">
          <EChart
            className="chart"
            option={option}
            onEvents={{
              click: (params) => {
                const payload = params as { data?: { voyageId?: string } };
                const voyageId = payload.data?.voyageId;
                const item = items.find((entry) => entry.voyageId === voyageId);
                if (item) {
                  onSelect(item);
                }
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
