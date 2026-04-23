F6：港口流向关系与航线对比分析模块（Port Flow & Route Comparison Module）
6.1 目标（Objective）

在现有航线与排放分析基础上，引入宏观流向关系 + 微观航线对比能力，实现：

展示多个港口之间的船只流向关系（OD Flow）
分析不同港口对之间的运输强度
支持从宏观流向 → 具体航线的下钻（drill-down）
对比所选航线与标准航线的关键指标差异

形成新的分析补充：

宏观（港口流向） → 选择航线 → 微观（航线性能对比）
6.2 布局（Layout）

该模块位于系统的右侧扩展分析区域 / 独立分析面板（可与地图同屏或切换视图）。

[ 弦图（港口流向） ]   [ 数据说明（Database Info） ]   [ 航线对比面板 ]
结构说明：
左：弦图（Chord Diagram） → 宏观流向
中：数据库说明 → 数据来源与定义
右：航线对比 → 微观分析

👉 实现 overview → detail → explanation

6.3 图1：港口流向弦图（Chord Diagram）
定义

展示 5 个港口之间的船只流动关系：

节点：港口（Port）
边（弦）：港口之间的船只流量
数据结构
interface PortFlow {
  source: string; // 港口A
  target: string; // 港口B
  value: number;  // 船只数量
}
示例港口（可写死用于展示）
Shanghai
Ningbo
Shenzhen
Qingdao
Tianjin
设计要点
弦宽（Chord Width） → 流量大小
颜色：
不同港口使用不同颜色
弦颜色继承 source 港口
支持方向（可选）：
渐变 / 箭头
交互设计
Hover
高亮某一港口 → 显示相关流向
Tooltip：
Shanghai → Ningbo
船只数量：128
Click（关键）

点击某条弦：

👉 触发：

筛选对应航线集合
更新地图
更新下方三图
更新右侧对比面板
作用
发现主要运输路径
找出高频港口对
为航线分析提供入口
6.4 中间模块：数据库说明（Database Explanation）
目标

解释数据来源与含义，提高可解释性（评分点）

展示内容
📊 数据来源：
AIS 航行数据（自动识别系统）

📍 数据范围：
- 时间：2023–2025
- 区域：中国沿海主要港口

🚢 数据字段：
- 航次ID（voyage_id）
- 起点港口（origin）
- 终点港口（destination）
- 时间序列（trajectory）
- 速度（speed）
- 碳排放（estimated）

⚙ 排放说明：
- 基于速度 + 距离的相对排放模型
- 非绝对值，仅用于比较
设计要点
使用卡片式展示（Card UI）
信息简洁（不要论文式）
作用

👉 解决老师最关心的问题：

数据从哪里来？
是否可信？
如何计算？
6.5 图2：航线对比面板（Route Comparison Panel）
目标

对比：

👉 当前选中航线 vs 标准航线

数据结构
interface RouteMetrics {
  metric: string;
  actual: number;
  standard: number;
}
指标设计（推荐）
指标	含义
总航行时间	duration
总距离	distance
平均速度	avg speed
最大速度	max speed
总碳排放	total emission
单位距离排放	emission efficiency
可视化形式（推荐）
方式1：表格（基础）
指标            实际航线    标准航线
-----------------------------------
总时间          12h        10h
总排放          320        260
平均速度        12.5       11.8
方式2：条形对比（推荐）
Actual   ███████████
Standard ████████
动态更新（关键）

当用户：

点击弦图
点击地图
切换航线

👉 自动更新该面板

作用

👉 提供“最终结论”：

是否更优？
差多少？
优在哪里？
6.6 模块联动关系
操作来源	联动结果
弦图点击	更新航线
地图选择	更新对比
左侧筛选	更新全部
核心流程
onChordClick(source, target)
  → filterVoyages(source, target)
  → updateMap()
  → updateCharts()
  → updateComparisonPanel()
6.7 状态管理
interface PortFlowState {
  selectedPortPair?: [string, string];
  selectedVoyageId?: string;
  routeMetrics?: RouteMetrics[];
}
6.8 非功能要求
弦图支持高亮与过滤
对比面板实时更新（<100ms）
数据量大时支持聚合
保持与 F1–F5 一致交互逻辑
6.9 设计亮点（高分点）
⭐ 宏观 + 微观结合

弦图（宏观） + 航线（微观）

⭐ 数据解释模块

👉 直接加分（老师很看重）

⭐ 强联动分析

一个点击 → 全系统响应

⭐ 决策支持
哪些港口流量大？
哪些航线效率低？
如何优化？
6.10 模块总结

本模块通过弦图展示港口间的流向关系，并结合航线对比面板，实现从宏观流量结构到具体航线性能的多层次分析，使系统具备更强的解释能力与决策支持能力。