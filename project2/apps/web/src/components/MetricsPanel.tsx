import type { RouteMetrics } from "../lib/api";
import { cnNumber, metricDeltaLabel } from "../lib/format";
import { Badge } from "./Badge";

interface MetricsPanelProps {
  metrics: RouteMetrics | null;
}

export function MetricsPanel({ metrics }: MetricsPanelProps) {
  if (!metrics) {
    return (
      <div className="panel">
        <div className="panel-header">
          <h3>航线对比面板</h3>
          <p>请选择航次查看实际航线与标准航线差异</p>
        </div>
      </div>
    );
  }

  const maxValue = Math.max(
    ...metrics.items.flatMap((item) => [item.actual, item.standard]),
    1
  );

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h3>航线对比面板</h3>
          <p>当前航次 vs 标准参考线</p>
        </div>
        <Badge sourceType={metrics.sourceType} />
      </div>
      <div className="metric-list">
        {metrics.items.map((item) => (
          <div key={item.metric} className="metric-item">
            <div className="metric-title">
              <span>{item.label}</span>
              <span>
                {metricDeltaLabel(item.delta)} {item.unit}
              </span>
            </div>
            <div className="metric-bars">
              <div>
                <small>实际 {cnNumber(item.actual)}</small>
                <div className="metric-bar">
                  <span
                    style={{ width: `${(item.actual / maxValue) * 100}%` }}
                    className="actual-bar"
                  />
                </div>
              </div>
              <div>
                <small>标准 {cnNumber(item.standard)}</small>
                <div className="metric-bar">
                  <span
                    style={{ width: `${(item.standard / maxValue) * 100}%` }}
                    className="standard-bar"
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
