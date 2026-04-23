import type { EChartsOption } from "echarts";
import type { ScatterItem } from "../lib/api";
import { EChart } from "./EChart";

interface ScatterPanelProps {
  items: ScatterItem[];
  onSelect: (item: ScatterItem) => void;
}

export function ScatterPanel({ items, onSelect }: ScatterPanelProps) {
  const option: EChartsOption = {
    grid: { left: 48, right: 24, top: 28, bottom: 42 },
    tooltip: {
      trigger: "item"
    },
    xAxis: {
      name: "航次序号",
      type: "category",
      data: items.map((item) => item.voyageIndex),
      axisLine: { lineStyle: { color: "#6b87a4" } }
    },
    yAxis: {
      name: "排放分数",
      type: "value",
      splitLine: { lineStyle: { color: "rgba(166, 193, 225, 0.1)" } }
    },
    series: [
      {
        type: "scatter",
        symbolSize: 14,
        data: items.map((item) => ({
          value: [item.voyageIndex, item.totalEmission],
          voyageId: item.voyageId,
          tooltipLabel: item.label,
          sourceType: item.sourceType
        })),
        itemStyle: {
          color: "#f7a64a",
          shadowBlur: 10,
          shadowColor: "rgba(247, 166, 74, 0.4)"
        }
      }
    ]
  };

  return (
    <div className="panel chart-panel">
      <div className="panel-header">
        <h3>航次排放散点</h3>
        <p>点击任意航次切换中央主视图</p>
      </div>
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
  );
}
