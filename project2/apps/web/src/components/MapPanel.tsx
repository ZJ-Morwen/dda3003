import { useMemo } from "react";

import { ENVIRONMENT_LAYER_LABELS } from "../../../../shared/contracts";
import type {
  EmissionSeriesPoint,
  EnvironmentFieldPayload,
  RouteGeometryPayload
} from "../lib/api";
import { cnNumber } from "../lib/format";
import MarineMap from "./MarineMap";

interface MapPanelProps {
  geometry: RouteGeometryPayload | null;
  environment: EnvironmentFieldPayload | null;
  points: EmissionSeriesPoint[];
  selectedTimestamp: string | null;
  onSelectTimestamp: (timestamp: string) => void;
  environmentLayers: readonly EnvironmentFieldPayload["layer"][];
  currentEnvironmentLayer: EnvironmentFieldPayload["layer"];
  onChangeEnvironmentLayer: (layer: EnvironmentFieldPayload["layer"]) => void;
}

export function MapPanel({
  geometry,
  environment,
  points,
  selectedTimestamp,
  onSelectTimestamp,
  environmentLayers,
  currentEnvironmentLayer,
  onChangeEnvironmentLayer
}: MapPanelProps) {
  const activePoint = useMemo(
    () => points.find((point) => point.ts === selectedTimestamp) ?? points[0] ?? null,
    [points, selectedTimestamp]
  );

  const mapMode = environment?.layer === "current" ? "current" : "wind";

  return (
    <div className="panel map-shell">
      <div className="panel-header">
        <div>
          <div className="map-title-row">
            <h3>Route Map</h3>
            <div className="env-switches map-env-switches">
              {environmentLayers.map((layer) => (
                <button
                  key={layer}
                  type="button"
                  className={`env-pill ${currentEnvironmentLayer === layer ? "active" : ""}`}
                  onClick={() => onChangeEnvironmentLayer(layer)}
                >
                  {ENVIRONMENT_LAYER_LABELS[layer]}
                </button>
              ))}
            </div>
          </div>
          <p>
            This view shows only the selected voyage, with the vessel's full AIS route and matching ideal route.
          </p>
        </div>
        <div className="map-header-right">
          {points.length > 0 ? <span className="map-caption">AIS points: {points.length}</span> : null}
          {activePoint ? (
            <span className="map-caption">
              {activePoint.ts.slice(5, 16).replace("T", " ")} | {cnNumber(activePoint.actualSpeed, 1)} kn
            </span>
          ) : null}
        </div>
      </div>
      <div className="map-wrapper">
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
