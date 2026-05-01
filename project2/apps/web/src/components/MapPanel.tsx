import { useMemo } from "react";

import type { SourceType } from "../../../../shared/contracts";
import type {
  EmissionSeriesPoint,
  EnvironmentFieldPayload,
  RouteGeometryPayload
} from "../lib/api";
import { cnNumber } from "../lib/format";
import { Badge } from "./Badge";
import MarineMap from "./MarineMap";

interface MapPanelProps {
  geometry: RouteGeometryPayload | null;
  environment: EnvironmentFieldPayload | null;
  points: EmissionSeriesPoint[];
  voyageSourceType: SourceType | null;
  environmentSourceType: SourceType | null;
  selectedTimestamp: string | null;
  onSelectTimestamp: (timestamp: string) => void;
  layerLabel: string;
}

export function MapPanel({
  geometry,
  environment,
  points,
  voyageSourceType,
  environmentSourceType,
  selectedTimestamp,
  onSelectTimestamp,
  layerLabel
}: MapPanelProps) {
  const activePoint = useMemo(
    () => points.find((point) => point.ts === selectedTimestamp) ?? points[0] ?? null,
    [points, selectedTimestamp]
  );

  const mapMode = environment?.layer === "current" ? "current" : "wind";

  return (
    <div
      className="panel map-shell"
      style={{ display: "flex", flexDirection: "column", height: "100%" }}
    >
      <div className="panel-header">
        <div>
          <h3>航迹地图</h3>
          <p>
            这里始终只显示当前选中的一条航次，并且加载这条船的完整 AIS 航迹和对应理想航线。
          </p>
        </div>
        <div className="map-header-right">
          {voyageSourceType ? <Badge sourceType={voyageSourceType} /> : null}
          {environmentSourceType ? <Badge sourceType={environmentSourceType} /> : null}
          {points.length > 0 ? <span className="map-caption">AIS points: {points.length}</span> : null}
          {activePoint ? (
            <span className="map-caption">
              {activePoint.ts.slice(5, 16).replace("T", " ")} | {cnNumber(activePoint.actualSpeed, 1)} kn
            </span>
          ) : null}
        </div>
      </div>
      <div className="map-wrapper" style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <MarineMap
          mode={mapMode}
          geometry={geometry}
          points={points}
          onSelectTimestamp={onSelectTimestamp}
        />
      </div>
    </div>
  );
}
