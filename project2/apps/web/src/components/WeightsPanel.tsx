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
          <p>Support-layer weights used to provide voyage context on the map.</p>
        </div>
        <Badge sourceType={weights.sourceType} />
      </div>
      <EChart className="chart compact-chart" option={option} />
    </div>
  );
}
