# AIS 数据可视化系统

这是一个基于 AIS (自动识别系统) 数据的可视化分析系统，用于展示天津到青岛航线的船舶航行数据。

## 功能特性

- **数据预处理**：将原始 AIS 数据转换为结构化格式
- **实时数据 API**：提供标准化的数据接口
- **多维度可视化**：
  - 地图可视化：展示船舶航行轨迹
  - 时间序列分析：展示航行时间分布
  - 数据卡片：展示关键统计指标
  - 散点图：分析航行速度与其他因素的关系
  - 和弦图：分析港口间的航行关系

## 技术栈

- **前端**：
  - React
  - TypeScript
  - Vite
  - ECharts

- **后端**：
  - Node.js
  - TypeScript
  - Fastify

- **数据处理**：
  - TypeScript
  - 自定义数据处理工具

## 项目结构

```
├── apps/
│   ├── api/           # 后端 API 服务
│   └── web/           # 前端可视化应用
├── data/
│   ├── generated/     # 生成的结构化数据
│   └── mock/          # 模拟数据
├── shared/            # 共享类型定义
├── tools/             # 数据预处理工具
├── package.json       # 项目配置
└── README.md          # 项目说明
```

## 安装与运行

### 1. 安装依赖

```bash
npm install
```

### 2. 数据预处理

```bash
npm run preprocess
```

此命令会处理原始 AIS 数据，生成结构化的 JSON 数据文件。

### 3. 启动服务

#### 启动 API 服务

```bash
npm run dev:api
```

API 服务默认运行在 http://localhost:8787

#### 启动 Web 服务

```bash
npm run dev:web
```

Web 服务默认运行在 http://localhost:5173

### 4. 访问应用

打开浏览器访问 http://localhost:5173 即可查看可视化应用。

## 数据说明

- **原始数据**：
  - `天津-青岛495个航次AIS.csv`：原始 AIS 数据
  - `天津青岛正常航线清洗数据.csv`：清洗后的航线数据

- **生成数据**：
  - `data/generated/real-data.json`：预处理后的结构化数据

- **地理数据**：
  - `china_ports.json`：中国港口数据
  - `china_routes.json`：中国航线数据

## 开发命令

- **预处理数据**：`npm run preprocess`
- **启动开发服务器**：
  - API: `npm run dev:api`
  - Web: `npm run dev:web`
- **构建项目**：`npm run build`
- **运行测试**：`npm test`

## 项目架构

### 后端 API

- **服务**：基于 Fastify 构建的 RESTful API
- **数据存储**：内存数据存储，使用预处理生成的 JSON 数据
- **端点**：
  - `/api/stats`：获取统计数据
  - `/api/voyages`：获取航次数据
  - `/api/ports`：获取港口数据

### 前端应用

- **组件**：
  - `MapPanel`：地图可视化组件
  - `TimeFilterStrip`：时间筛选组件
  - `DataCards`：数据卡片组件
  - `MetricsPanel`：指标面板组件
  - `ScatterPanel`：散点图组件
  - `ChordPanel`：和弦图组件

- **状态管理**：使用自定义 store 管理应用状态
- **API 调用**：通过 `api.ts` 模块与后端通信

## 部署说明

1. **构建生产版本**：
   ```bash
   npm run build
   ```

2. **部署 API 服务**：
   - 部署 `apps/api/dist` 目录
   - 设置环境变量（如果需要）

3. **部署 Web 应用**：
   - 部署 `apps/web/dist` 目录到静态文件服务器
   - 配置 API 服务地址（如果与前端不在同一域名）

## 技术亮点

- **模块化设计**：清晰的代码结构和职责分离
- **类型安全**：全面使用 TypeScript 确保类型安全
- **性能优化**：数据预处理减少运行时计算
- **响应式设计**：适配不同屏幕尺寸
- **交互式可视化**：丰富的用户交互体验

## 未来计划

- [ ] 添加更多数据分析维度
- [ ] 支持实时数据更新
- [ ] 增强用户交互功能
- [ ] 优化大数据集处理性能
- [ ] 添加用户认证和权限管理

## 许可证

本项目采用 MIT 许可证。

## 联系方式

如有问题或建议，请联系项目维护者。
