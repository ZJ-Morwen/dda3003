# 多港口 AIS 可视化平台

这个项目基于 `cleaned_ais_data/` 下的真实 AIS CSV，构建多港口、多航次的联动可视化页面。

当前页面包含：

- 弦图：显示所有港口之间的航线数量
- 地图：只显示当前选中航次的 `实际 AIS 航迹` 和 `理想航线`
- 地图下方三张趋势图：
  - `Emission Trend`
  - `Speed Trend`
  - `Cumulative Delta`
- 页面底部整行散点图
- 散点图支持按 `起点港口` 和 `终点港口` 筛选

## 重要：只使用这个新目录启动

你电脑里现在有两份 `project2`：

- 旧目录：`C:\Users\38796\dda3003\project2`
- 新目录：`C:\Users\38796\dda3003\project2\dda3003\project2`

以后只使用下面这个目录启动项目：

```text
C:\Users\38796\dda3003\project2\dda3003\project2
```

如果你从外层旧目录运行 `npm run dev:web` 或 `npm run dev:api`，打开的就还是老版本。

## 当前数据

最新一次预处理结果来自 `cleaned_ais_data/*.csv`，当前规模为：

- `1,585,744` 个 AIS 点
- `450` 条航次
- `7` 组港口对
- 时间范围：`2025-01-04T15:26:30.000Z` 到 `2027-01-20T00:18:17.000Z`

当前识别出的港口对：

- `Qingdao -> Ningbo`：`105`
- `Shenzhen -> Ningbo`：`95`
- `Guangzhou -> Ningbo`：`78`
- `Qingdao -> Shanghai`：`57`
- `Tianjin -> Qingdao`：`50`
- `Ningbo -> Shenzhen`：`41`
- `Qingdao -> Tianjin`：`24`

## 项目结构

```text
project2/
├─ apps/
│  ├─ api/                      # Fastify API
│  └─ web/                      # React + Vite 前端
├─ cleaned_ais_data/            # 输入 AIS CSV
├─ data/
│  ├─ generated/
│  │  ├─ real-data.json         # 全量航次摘要
│  │  └─ voyages/*.json         # 每条航次的完整 AIS 点
│  └─ mock/                     # 环境图层辅助数据
├─ shared/                      # 前后端共享类型
├─ tools/                       # 预处理脚本
├─ package.json
└─ README.md
```

## 运行步骤

建议开两个终端，一个跑 API，一个跑前端。

### 1. 进入新目录

先切到唯一正确的新目录：

```powershell
Set-Location C:\Users\38796\dda3003\project2\dda3003\project2
```

### 2. 安装依赖

```bash
npm install
```

### 3. 预处理 AIS 数据

```bash
npm run preprocess
```

这一步会：

- 扫描 `cleaned_ais_data/` 下全部 CSV
- 按 `routeId` 聚合航次
- 重建航次点序，尽量修复轨迹断裂
- 按每条航次的 `起点港口 -> 终点港口` 分类
- 生成 `data/generated/real-data.json`
- 生成 `data/generated/voyages/*.json`

### 4. 启动后端 API

在第一个终端执行：

```powershell
Set-Location C:\Users\38796\dda3003\project2\dda3003\project2
npm run dev:api
```

默认地址：

- `http://127.0.0.1:8787`

### 5. 启动前端

在第二个终端执行：

```powershell
Set-Location C:\Users\38796\dda3003\project2\dda3003\project2\apps\web
npm run dev -- --host=127.0.0.1
```

固定使用：

- `http://127.0.0.1:5173`

### 6. 打开页面

浏览器访问：

- `http://127.0.0.1:5173`

## 页面怎么用

### 1. 弦图

- 默认显示所有港口和所有流向
- 点击某一条流后，会高亮这条港口对
- 点击后会同步更新散点图筛选

### 2. 地图

- 地图只显示当前选中的一条航次
- 同时展示：
  - `实际 AIS 航迹`
  - `理想航线`
- 实际 AIS 航迹读取的是该航次完整点位，不做前端裁剪

### 3. 地图下方三张图

- `Emission Trend`：实际排放 vs 参考排放
- `Speed Trend`：实际速度 vs 参考速度
- `Cumulative Delta`：累计排放差值

点击图上的点会联动地图时间点。

### 4. 底部散点图

- 散点图位于页面最底部，宽度更大，方便看全
- 左侧可以选：
  - `起点港口`
  - `终点港口`
- 散点图只显示当前港口对下的航次
- 点击某个散点后，地图和三张趋势图会切换到该航次

## 常用命令

```bash
npm run preprocess
npm run dev:api
npm run dev:web
npm run build:api
npm run build:web
npm run test:api
```

## 常见问题

### 1. 为什么总是打开老版本

通常只有两个原因：

1. 你在旧目录里启动了服务
2. `5173` 或 `8787` 端口上还挂着旧进程

一定要确认你启动命令所在目录是：

```text
C:\Users\38796\dda3003\project2\dda3003\project2
```

不是：

```text
C:\Users\38796\dda3003\project2
```

### 2. 如何停掉旧端口

在 PowerShell 执行：

```powershell
$ports = 5173,8787
$pids = Get-NetTCPConnection -State Listen |
  Where-Object { $ports -contains $_.LocalPort } |
  Select-Object -ExpandProperty OwningProcess -Unique
$pids | ForEach-Object { Stop-Process -Id $_ -Force }
```

然后重新启动：

```powershell
Set-Location C:\Users\38796\dda3003\project2\dda3003\project2
npm run dev:api
```

```powershell
Set-Location C:\Users\38796\dda3003\project2\dda3003\project2\apps\web
npm run dev -- --host=127.0.0.1
```

最后浏览器强刷：

- `Ctrl+F5`

### 3. 为什么不能直接删掉外层旧目录

现在这份新版本并不是和旧版本并排放着，而是位于外层目录内部：

- 外层目录：`C:\Users\38796\dda3003\project2`
- 当前新版本：`C:\Users\38796\dda3003\project2\dda3003\project2`

所以不能直接删除整个外层目录 `C:\Users\38796\dda3003\project2`，否则里面这份新版本也会一起被删掉。

当前最安全的做法是：

- 不删除外层目录
- 只从新目录 `C:\Users\38796\dda3003\project2\dda3003\project2` 启动
- 如果误开了旧版本，就先停掉旧端口，再按本 README 的新路径重启

如果后面真的要彻底整理目录，应该先把新版本迁移到外层，再删除旧代码；这一步属于文件迁移，不建议在还在开发时直接做。

### 4. 怎么确认已经是新后端

执行：

```powershell
(Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8787/api/dashboard/snapshot).Content
```

如果返回里有：

- `availableTimeRange`
- 多港口 `portFlows`
- 多港口 `scatter`

说明已经切到新接口。

### 5. 地图没有轨迹

地图不会默认显示所有航次。

你需要先：

1. 在弦图或散点图里筛到目标港口对
2. 点击散点图里的某一个航次点

选中后，地图才会显示这条航次的 `实际 AIS 航迹` 和 `理想航线`。

### 6. 改了 CSV 但页面没更新

重新生成数据：

```bash
npm run preprocess
```

如果 API 正在运行，建议 API 也重启一次。

## 开发说明

- 航次按 `routeId` 分组
- 航次点序会在预处理阶段做空间连续性重建，尽量修复轨迹断裂
- 航次分类按每条航次自己的 `起点港口 -> 终点港口` 识别
- `real-data.json` 只保留摘要
- 完整 AIS 点保存在 `data/generated/voyages/*.json`
- 理想航线尽量沿海上可行路径生成，避免明显穿陆

## 已验证命令

最近一次已通过：

```bash
npm run preprocess
npm run build:api
npm run build:web
npm run test:api
```
