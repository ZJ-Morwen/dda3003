import type { EmissionSeriesPoint } from "../lib/api";
import { cnNumber } from "../lib/format";
import { Badge } from "./Badge";

interface DetailPanelProps {
  point: EmissionSeriesPoint | null;
}

export function DetailPanel({ point }: DetailPanelProps) {
  if (!point) {
    return (
      <div className="panel">
        <div className="panel-header">
          <h3>详情浮层</h3>
          <p>点击地图或时间图后显示对应时刻信息</p>
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h3>详情浮层</h3>
          <p>{point.ts.replace("T", " ").slice(0, 16)}</p>
        </div>
        <Badge sourceType={point.sourceType} />
      </div>
      <div className="detail-grid">
        <div>
          <h4>实际航线</h4>
          <p>
            位置：{cnNumber(point.lat, 3)}N, {cnNumber(point.lon, 3)}E
          </p>
          <p>速度：{cnNumber(point.actualSpeed, 2)} knots</p>
          <p>排放：{cnNumber(point.actualEmission, 2)}</p>
        </div>
        <div>
          <h4>标准航线</h4>
          <p>
            位置：{cnNumber(point.refLat, 3)}N, {cnNumber(point.refLon, 3)}E
          </p>
          <p>速度：{cnNumber(point.standardSpeed, 2)} knots</p>
          <p>排放：{cnNumber(point.standardEmission, 2)}</p>
        </div>
        <div>
          <h4>差值分析</h4>
          <p>
            当前差值：
            {cnNumber(point.actualEmission - point.standardEmission, 2)}
          </p>
          <p>累计差值：{cnNumber(point.deltaCumulative, 2)}</p>
        </div>
      </div>
    </div>
  );
}
