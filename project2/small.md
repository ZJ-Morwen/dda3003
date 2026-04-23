F5：碳排放动态分析与对比模块（Emission Analysis Module）
5.1 目标（Objective）

在现有「地图航线展示 + 航次选择 + 环境层」基础上，引入时间序列分析能力，实现：

实时刻画航次在航行过程中的碳排放变化
分析速度变化对碳排放的影响机制
对比实际航线与标准航线（reference route）
通过累计差值评估航线优化效果

形成完整分析闭环：

空间（地图） → 行为（速度） → 过程（排放） → 结果（累计差值）
5.2 布局（Layout）

本模块位于中央大地图下方区域（Dashboard 下半部分），作为地图的分析面板。

[ 🌍 中央大地图（航线 + 环境动画） ]

[ Emission-Time ]   [ Speed-Time ]   [ ΔEmission（累计差值） ]
设计说明：
三图横向排列（支持响应式换行）
与地图共享：
selectedVoyageId
timeFilter
属于地图的“分析扩展区域”，非独立页面
所有图共享统一时间轴（核心设计要求）
5.3 图1：碳排放-时间曲线（Emission-Time）
定义
x轴：时间（与 timeFilter 对齐）
y轴：相对碳排放强度（Relative Emission）
数据结构
interface EmissionPoint {
  ts: string; // ISO 时间
  emission: number;
  type: 'actual' | 'standard';
}
设计要点
双曲线：
实际航线（Actual）
标准航线（Standard）
支持面积填充（Area Chart）
Hover 显示精确数值
与其他图完全同步（shared x-axis）
作用

展示碳排放的动态变化过程，是分析核心基础。

5.4 图2：速度-时间曲线（Speed-Time）
定义
x轴：时间
y轴：速度（knots）
数据结构
interface SpeedPoint {
  ts: string;
  speed: number;
  type: 'actual' | 'standard';
}
设计要点
与图1共享时间轴
双曲线（actual vs standard）
支持 hover / brush 联动
作用

用于解释排放变化原因：

👉 建立「速度 → 排放」因果关系

5.5 图3：累计排放差值曲线（ΔEmission）
定义

累计差值：

ΔC(t) = ∫(E_actual - E_standard) dt
数据结构
interface EmissionDeltaPoint {
  ts: string;
  deltaCumulative: number;
}
设计要点
单曲线（累积差）
支持参考线（0 baseline）
强调终点值（总差）
曲线解释
趋势	含义
上升	实际航线更耗碳
平稳	接近最优
下降	实际航线更优
作用（核心）
定量评估航线优劣
定位关键高排放时间段
支撑优化决策
5.6 点击与交互（新增重点 🔥）
5.6.1 Hover（轻量交互）

鼠标悬停任意图表位置：

显示 Tooltip：

时间：10:32
实际排放：0.82
标准排放：0.65
实际速度：12.4 knots
标准速度：11.8 knots
Δ累计：+1.25

👉 同时：

地图高亮对应位置
船只移动到该时间点
5.6.2 Click（深度交互）

点击某一点：

触发 Detail Panel（详情面板）

详情面板内容（推荐放右侧浮层）
📍 时间：2026-04-17 10:32

🚢 实际航线
- 位置：22.31N, 114.12E
- 速度：12.4 knots
- 排放：0.82

📈 标准航线
- 速度：11.8 knots
- 排放：0.65

⚠ 差值分析
- 排放差：+0.17
- 累计差：+1.25

🌊 环境信息（可选）
- 风速：8.2 m/s
- 浪高：1.4 m
5.6.3 Brush（高级交互，可加分）

用户拖动时间区间：

高亮时间段
地图仅播放该区间
三图局部放大
5.7 与现有模块的联动关系
来源	影响
timeFilter	刷新三图
selectedVoyageId	切换数据
地图时间轴	同步三图
核心流程
onScatterPointClick(voyageId)
  → set selectedVoyageId
  → refreshEmissionAnalysis(voyageId, timeFilter)
5.8 数据接口扩展
GET /api/voyages/{voyageId}/emission-series
返回格式
{
  "points": [
    {
      "ts": "2026-04-17T10:00:00+08:00",
      "actualEmission": 0.8,
      "standardEmission": 0.6,
      "actualSpeed": 12.5,
      "standardSpeed": 11.8
    }
  ]
}
5.9 前端处理逻辑
function buildDelta(points) {
  let sum = 0;
  return points.map(p => {
    const diff = p.actualEmission - p.standardEmission;
    sum += diff;
    return {
      ts: p.ts,
      deltaCumulative: sum
    };
  });
}
5.10 状态扩展
interface EmissionAnalysisState {
  emissionSeries: EmissionPoint[];
  speedSeries: SpeedPoint[];
  deltaSeries: EmissionDeltaPoint[];
  selectedTimestamp?: string;
}
5.11 刷新函数
function refreshEmissionAnalysis(
  voyageId: string,
  timeFilter: TimeFilter
): Promise<void>;
5.12 非功能要求
与 F1–F4 保持一致刷新机制
三图必须共享时间轴（避免认知割裂）
支持 loading / 空态
支持降采样（大数据优化）
Tooltip 响应 < 50ms（交互流畅）
5.13 模块总结

本模块在地图空间展示基础上，引入时间序列分析能力，构建：

行为（速度） → 过程（排放） → 结果（累计差值）

的完整分析链路，使系统从“展示航线”升级为：

👉 可解释 + 可量化 + 可优化 的决策系统