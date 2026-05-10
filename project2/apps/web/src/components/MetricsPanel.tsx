import type { RouteMetrics } from "../lib/api";
import { cnNumber, metricDeltaLabel } from "../lib/format";

interface MetricsPanelProps {
  metrics: RouteMetrics | null;
}

function getMetricBarWidth(value: number, pairMax: number): string {
  if (value <= 0 || pairMax <= 0) {
    return "0%";
  }

  const scaledWidth = (value / pairMax) * 100;
  return `${Math.max(scaledWidth, 3)}%`;
}

function getDisplayLabel(metric: string, fallback: string): string {
  switch (metric) {
    case "totalEmission":
      return "Total Emission Index";
    case "emissionPerNm":
      return "Emission Index per NM";
    default:
      return fallback;
  }
}

function getDisplayUnit(metric: string, fallback: string): string {
  switch (metric) {
    case "totalEmission":
      return "Emission Index";
    case "emissionPerNm":
      return "Index/NM";
    default:
      return fallback;
  }
}

export function MetricsPanel({ metrics }: MetricsPanelProps) {
  if (!metrics) {
    return (
      <div className="panel metrics-panel">
        <div className="panel-header">
          <h3>Actual vs Reference Route</h3>
          <p>Select a voyage to compare the actual route with the reference route.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="panel metrics-panel">
      <div className="panel-header">
        <div className="panel-header-stack">
          <h3>Actual vs Reference Route</h3>
          <p>Current voyage vs reference route</p>
          <p className="panel-note">
            Emission Index is a normalized relative indicator used to compare emission burden
            between voyages. It is not an absolute CO2 measurement. Waiting time outside a port
            is included because it can still produce emissions.
          </p>
        </div>
      </div>
      <div className="metric-list">
        {metrics.items.map((item) => {
          const pairMax = Math.max(item.actual, item.standard, 1);
          const displayLabel = getDisplayLabel(item.metric, item.label);
          const displayUnit = getDisplayUnit(item.metric, item.unit);

          return (
            <div key={item.metric} className="metric-item">
              <div className="metric-title">
                <span className="metric-name">{displayLabel}</span>
                <span className="metric-delta">
                  {metricDeltaLabel(item.delta)} {displayUnit}
                </span>
              </div>
              <div className="metric-bars">
                <div>
                  <small>Actual {cnNumber(item.actual)}</small>
                  <div className="metric-bar">
                    <span
                      style={{ width: getMetricBarWidth(item.actual, pairMax) }}
                      className="actual-bar"
                    />
                  </div>
                </div>
                <div>
                  <small>Reference {cnNumber(item.standard)}</small>
                  <div className="metric-bar">
                    <span
                      style={{ width: getMetricBarWidth(item.standard, pairMax) }}
                      className="standard-bar"
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
