# Multi-Port AIS Visualization Platform

基于 `cleaned_ais_data/` 中的真实 AIS CSV 数据，构建多港口、多航次、可联动的航线与排放可视化平台。

当前项目由三部分组成：

- `apps/web`：React + Vite 前端
- `apps/api`：Fastify 后端
- `shared`：前后端共享类型定义

配套说明文档：

- [CODE_LOGIC_OVERVIEW.md](./CODE_LOGIC_OVERVIEW.md)

## 当前页面内容

- `Voyage Emission Overview`
  用散点图查看不同港口对航次的排放分布，并按起点/终点筛选
- `Route Map`
  展示当前选中航次的实际 AIS 航线和预测低排放参考航线
- `Environment Mix`
  展示风、流、浪对当前航次的相对影响权重
- 左侧三张联动趋势图
  - `Emission Trend`
  - `Speed Trend`
  - `Cumulative Emission Index`
- `Actual vs Reference Route`
  对比真实航次与预测航次的核心指标
- `Port Flow Chord`
  展示港口之间的航次流向关系
- `Point Detail`
  查看当前时间点的实际值、预测值和累计差值

## 数据真实性说明

这个项目现在不是“全部都是真实原始数据”，而是三类数据混合：

- `真实数据`
  来自 `cleaned_ais_data/*.csv` 的 AIS 航次点，经预处理后生成 `data/generated/*.json`
- `派生数据`
  预测航线、预测速度、预测排放、指标卡中的对比值，都由真实 AIS 历史航次推导得到
- `合成数据`
  地图上的风场/流场/浪场仍然是可视化辅助层，不是真实海洋观测产品

特别说明：

- 页面中的排放值已经统一叫做 `Emission Index`
- `Emission Index` 是归一化的相对指标，用来比较不同航次的排放负担
- 它不是绝对 CO2 测量值

## 当前预测逻辑

现在每条真实航次只对应 `1` 条预测航线，不再使用过去那种多条伪造候选线。

预测航线的生成方式是：

- 先按港口对收集真实历史航次
- 按单位距离排放强度筛选低排放历史样本
- 从这些真实样本中提取一条低排放 `eco-corridor`
- 再将参考航线约束在接近当前真实 AIS 航线的海上可行范围内

因此：

- 左侧图表中的 `Predicted`
- 地图中的参考航线
- 指标卡中的 `Reference`

都来自同一套预测参考模型，只是展示形式不同。

## 当前数据规模

最近一次预处理后的数据规模如下：

- AIS 点数：`1,585,744`
- 航次数：`450`
- 港口对数量：`7`
- 时间范围：`2025-01-04T15:26:30.000Z` 到 `2027-01-20T00:18:17.000Z`

当前识别出的港口对：

- `Qingdao -> Ningbo`：`105`
- `Shenzhen -> Ningbo`：`95`
- `Guangzhou -> Ningbo`：`78`
- `Qingdao -> Shanghai`：`57`
- `Tianjin -> Qingdao`：`50`
- `Ningbo -> Shenzhen`：`41`
- `Qingdao -> Tianjin`：`24`

## 目录结构

```text
project2/
├─ apps/
│  ├─ api/                    # Fastify API
│  └─ web/                    # React + Vite 前端
├─ cleaned_ais_data/          # 输入 AIS CSV
├─ data/
│  ├─ generated/
│  │  ├─ real-data.json       # 全量航次摘要
│  │  └─ voyages/*.json       # 每条航次的完整序列
│  └─ mock/                   # 环境层种子与辅助演示数据
├─ shared/                    # 共享 contracts
├─ tools/                     # 预处理脚本
├─ CODE_LOGIC_OVERVIEW.md
└─ README.md
```

## 启动方式

请始终从这个目录启动项目：

```powershell
Set-Location C:\Users\38796\dda3003_fresh\project2
```

### 1. 安装依赖

```powershell
npm install
```

### 2. 预处理 AIS 数据

```powershell
npm run preprocess
```

这一步会：

- 扫描 `cleaned_ais_data/` 下全部 CSV
- 按航次聚合 AIS 点
- 清洗并重建轨迹顺序
- 推断港口对
- 生成真实航次数据
- 生成预测参考航线和参考速度/排放序列

### 3. 启动后端

在第一个终端执行：

```powershell
Set-Location C:\Users\38796\dda3003_fresh\project2
npm run dev:api
```

默认地址：

- `http://127.0.0.1:8787`

### 4. 启动前端

在第二个终端执行：

```powershell
Set-Location C:\Users\38796\dda3003_fresh\project2\apps\web
npm run dev -- --host=127.0.0.1
```

前端通常会使用：

- `http://127.0.0.1:5173`

如果 `5173` 被占用，Vite 会自动切换到 `5174` 或其他端口，请以终端输出为准。

## 常用命令

```powershell
npm run preprocess
npm run dev:api
npm run dev:web
npm run build:api
npm run build:web
npm run test:api
npm run test:web
```

## 交互说明

### 1. 散点图

- 按港口对查看航次排放分布
- 点击某个航次点后：
  - 地图切换到该航次
  - 左侧三张图切换到该航次
  - 指标卡与详情卡同步更新

### 2. 左侧三张图

- 点击时间点可联动其他两张图
- 点击两次可选中一个时间区间
- 选中时间区间后：
  - 地图高亮显示该时间段的实际航段和参考航段
  - 可通过 `Clear Range` 清除选区

### 3. 地图

- 默认显示当前航次的完整实际 AIS 航线
- 同时显示预测参考航线
- 选中时间区间时，会额外高亮该时间段对应的航段

### 4. 环境混合图

- 展示风、流、浪对当前航次的相对影响
- 这个权重是基于当前航次轨迹与合成环境场计算出来的相对值

## 已知边界

- 风、流、浪环境层目前仍是合成可视化层，不应当被解释为真实海况观测
- `Emission Index` 是相对指标，不应当当作绝对排放量
- 部分港口点和航线端点做了吸附与清洗，以提升可视化稳定性
- 图表为了可读性会对高密度时序点做裁剪和采样，因此图上显示值可能与原始逐点值略有差异

## 常见问题

### 1. 前端页面打不开

先确认后端是否已经启动：

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8787/api/dashboard/snapshot
```

再确认前端终端里最终输出的是哪个地址。

### 2. 改了 CSV 但页面没有更新

重新预处理并重启后端：

```powershell
Set-Location C:\Users\38796\dda3003_fresh\project2
npm run preprocess
npm run dev:api
```

前端建议也重启一次，或者浏览器强刷：

- `Ctrl + F5`

### 3. 端口被旧进程占用

```powershell
$ports = 5173,5174,8787
$pids = Get-NetTCPConnection -State Listen |
  Where-Object { $ports -contains $_.LocalPort } |
  Select-Object -ExpandProperty OwningProcess -Unique
$pids | ForEach-Object { Stop-Process -Id $_ -Force }
```

## 最近验证过的命令

```powershell
npm run preprocess
npm run build:api
npm run build:web
npm run test:api
```
