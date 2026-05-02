import type { RouteMetrics } from "../lib/api";
import { cnNumber, metricDeltaLabel } from "../lib/format";

interface MetricsPanelProps {
  metrics: RouteMetrics | null;
}

export function MetricsPanel({ metrics }: MetricsPanelProps) {
  if (!metrics) {
    return (
      <div className="panel metrics-panel">
        <div className="panel-header">
          <h3>Route Comparison</h3>
          <p>Select a voyage to compare the actual route with the reference route.</p>
        </div>
      </div>
    );
  }

  const maxValue = Math.max(
    ...metrics.items.flatMap((item) => [item.actual, item.standard]),
    1
  );

  return (
    <div className="panel metrics-panel">
      <div className="panel-header">
        <div>
          <h3>Route Comparison</h3>
          <p>Current voyage vs reference route</p>
        </div>
      </div>
      <div className="metric-list">
        {metrics.items.map((item) => (
          <div key={item.metric} className="metric-item">
            <div className="metric-title">
              <span className="metric-name">{item.label}</span>
              <span className="metric-delta">
                {metricDeltaLabel(item.delta)} {item.unit}
              </span>
            </div>
            <div className="metric-bars">
              <div>
                <small>Actual {cnNumber(item.actual)}</small>
                <div className="metric-bar">
                  <span
                    style={{ width: `${(item.actual / maxValue) * 100}%` }}
                    className="actual-bar"
                  />
                </div>
              </div>
              <div>
                <small>Reference {cnNumber(item.standard)}</small>
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
