import { useMemo } from "react";
import MarineMap from './MarineMap'; // 引入我们新写的流体地图组件

import type { SourceType } from "../../../../shared/contracts";
import type {
  EmissionSeriesPoint,
  EnvironmentFieldPayload,
  RouteGeometryPayload
} from "../lib/api";
import { Badge } from "./Badge";
import { cnNumber } from "../lib/format";

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
    () =>
      points.find((point) => point.ts === selectedTimestamp) ?? points[0] ?? null,
    [points, selectedTimestamp]
  );

  // 提取当前需要渲染的环境场类型 (wind / current / wave)
  const mapMode = environment?.layer || 'wind';

  return (
    <div className="panel map-shell" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="panel-header">
        <div>
          <h3>航线空间地图</h3>
          {/* 这里文案稍微改一下，体现是流体场 */}
          <p>Leaflet 主视图 + {layerLabel}流体粒子场</p> 
        </div>
        <div className="map-header-right">
          {voyageSourceType ? <Badge sourceType={voyageSourceType} /> : null}
          {environmentSourceType ? <Badge sourceType={environmentSourceType} /> : null}
          {activePoint ? (
            <span className="map-caption">
              {activePoint.ts.slice(5, 16).replace("T", " ")} ·{" "}
              {cnNumber(activePoint.actualSpeed, 1)} kn
            </span>
          ) : null}
        </div>
      </div>
      
      {/* 核心地图渲染区，确保有 flex: 1 撑开高度 */}
      <div className="map-wrapper" style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <MarineMap 
          mode={mapMode as any} 
          geometry={geometry} 
          points={points} 
          onSelectTimestamp={onSelectTimestamp} 
        />
      </div>
    </div>
  );
}