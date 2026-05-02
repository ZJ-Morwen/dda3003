import type { EmissionSeriesPoint } from "../lib/api";
import { cnNumber } from "../lib/format";

interface DetailPanelProps {
  point: EmissionSeriesPoint | null;
}

export function DetailPanel({ point }: DetailPanelProps) {
  if (!point) {
    return (
      <div className="panel detail-panel">
        <div className="panel-header">
          <h3>Point Detail</h3>
          <p>Click a scatter point, then click the map route or AIS points to inspect a moment.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="panel detail-panel detail-panel-active">
      <div className="panel-header">
        <div>
          <div className="detail-title-row">
            <h3>Point Detail</h3>
            <span>{point.ts.replace("T", " ").slice(0, 16)}</span>
          </div>
        </div>
      </div>
      <div className="detail-grid">
        <div>
          <h4>Actual route</h4>
          <p>
            Position: {cnNumber(point.lat, 3)}N, {cnNumber(point.lon, 3)}E
          </p>
          <p>Speed: {cnNumber(point.actualSpeed, 2)} knots</p>
          <p>Emission: {cnNumber(point.actualEmission, 2)}</p>
        </div>
        <div>
          <h4>Ideal route</h4>
          <p>
            Position: {cnNumber(point.refLat, 3)}N, {cnNumber(point.refLon, 3)}E
          </p>
          <p>Speed: {cnNumber(point.standardSpeed, 2)} knots</p>
          <p>Emission: {cnNumber(point.standardEmission, 2)}</p>
        </div>
        <div>
          <h4>Delta</h4>
          <p>Current delta: {cnNumber(point.actualEmission - point.standardEmission, 2)}</p>
          <p>Cumulative delta: {cnNumber(point.deltaCumulative, 2)}</p>
        </div>
      </div>
    </div>
  );
}
