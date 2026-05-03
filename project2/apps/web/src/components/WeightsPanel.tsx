import type { EChartsOption } from "echarts";

import type { DashboardSnapshot } from "../lib/api";
import { EChart } from "./EChart";

interface WeightsPanelProps {
  weights: DashboardSnapshot["weights"];
}

export function WeightsPanel({ weights }: WeightsPanelProps) {

  const option: EChartsOption = {
    tooltip: { trigger: "item" },
    legend: {
      top: "84%",
      left: "46%",
      itemWidth: 18,
      itemHeight: 10,
      textStyle: { color: "#d2e6ff" }
    },
    series: [
      {
        type: "pie",
        radius: ["34%", "55%"],
        center: ["46%", "42%"],
        avoidLabelOverlap: true,
        itemStyle: {
          borderColor: "#081521",
          borderWidth: 4
        },
        label: {
          color: "#f2fbff",
          formatter: "{b}\n{d}%"
        },
        labelLine: {
          length: 10,
          length2: 14
        },
        data: [
          { name: "Wind", value: weights.weights.wind, itemStyle: { color: "#7ed0ff" } },
          { name: "Current", value: weights.weights.current, itemStyle: { color: "#54f0bd" } },
          { name: "Wave", value: weights.weights.wave, itemStyle: { color: "#ffd36b" } }
        ]
      }
    ]
  };

  return (
    <div className="panel chart-panel">
      <div className="panel-header">
        <div>
          <h3>Environment Mix</h3>
          <p>Relative influence of wind, current, and wave</p>
        </div>
      </div>
      <EChart className="chart compact-chart" option={option} />
    </div>
  );
}
