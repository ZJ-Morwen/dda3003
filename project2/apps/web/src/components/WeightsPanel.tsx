import type { EChartsOption } from "echarts";
import type { DashboardSnapshot } from "../lib/api";
import { Badge } from "./Badge";
import { EChart } from "./EChart";

interface WeightsPanelProps {
  snapshot: DashboardSnapshot;
}

export function WeightsPanel({ snapshot }: WeightsPanelProps) {
  const { weights } = snapshot;
  const option: EChartsOption = {
    tooltip: { trigger: "item" },
    legend: {
      bottom: 0,
      textStyle: { color: "#d2e6ff" }
    },
    series: [
      {
        type: "pie",
        radius: ["45%", "72%"],
        avoidLabelOverlap: false,
        itemStyle: {
          borderColor: "#081521",
          borderWidth: 4
        },
        label: {
          color: "#f2fbff",
          formatter: "{b}\n{d}%"
        },
        data: [
          { name: "风场", value: weights.weights.wind, itemStyle: { color: "#7ed0ff" } },
          { name: "洋流", value: weights.weights.current, itemStyle: { color: "#54f0bd" } },
          { name: "波浪", value: weights.weights.wave, itemStyle: { color: "#ffd36b" } }
        ]
      }
    ]
  };

  return (
    <div className="panel chart-panel">
      <div className="panel-header">
        <div>
          <h3>环境权重饼图</h3>
          <p>当前时间窗下的环境影响占比</p>
        </div>
        <Badge sourceType={weights.sourceType} />
      </div>
      <EChart className="chart compact-chart" option={option} />
    </div>
  );
}
