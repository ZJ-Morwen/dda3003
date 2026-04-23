# 航次钻取控制 — 数据接口文档（负责部分）

本文档定义**前后端分离**下，支撑「散点图–航线联动」「环境动画与自检」「权重饼图」「全局时间过滤」所需 HTTP API、数据类型、错误码及与前端函数的对应关系。基路径、鉴权方式由项目统一配置（本文用 `/api` 前缀示例）。

**配套文档**：[`docs/feature-voyage-drilldown.md`](feature-voyage-drilldown.md)（功能与交互）。两份文档路径以仓库内上述文件为准。

---

## 1. 通用约定

### 1.1 传输与格式

| 项 | 约定 |
|----|------|
| 协议 | HTTPS |
| 请求体 | `Content-Type: application/json`（GET 无 body） |
| 响应体 | JSON；字符编码 UTF-8 |
| 字段命名 | `camelCase`（若后端为 snake_case，由 BFF 或前端适配层转换，全项目统一一种） |

### 1.2 日期与时间

| 类型 | 格式 | 说明 |
|------|------|------|
| `date` | `YYYY-MM-DD` | 自然日，按 **Asia/Shanghai** 日历解释（与功能文档一致）。 |
| `dateTime` | ISO 8601，如 `2026-04-17T14:30:00+08:00` | 用于 `computedAt`、`ts` 等。 |

### 1.3 时间区间语义（重要）

所有接受 `startDate` / `endDate` 的查询接口，区间语义统一为：

**`[startDate, endDate]` 闭区间** — 包含起止两个自然日全天（按上海时区日界）。

例：`startDate=2026-04-11`、`endDate=2026-04-13` 表示 11、12、13 三日数据。

单日查询可传 `startDate = endDate = D`。

功能文档中的 `timeFilter` 与查询参数映射：

| `timeFilter` | `startDate` | `endDate` |
|--------------|-------------|-----------|
| `{ mode: 'single_day', startDay: D }` | `D` | `D` |
| `{ mode: 'range', startDay: D1, endDay: D2 }` | `D1` | `D2` |

### 1.4 错误响应

HTTP 状态码与业务错误分离：4xx/5xx 表示 HTTP 层；业务错误时仍可能返回 200 + `success: false`（组内二选一并全项目统一）。推荐**失败时 HTTP 4xx/5xx + 统一 body**：

```json
{
  "code": "string",
  "message": "string",
  "details": null
}
```

| `code` 示例 | HTTP | 说明 |
|-------------|------|------|
| `VALIDATION_ERROR` | 400 | 参数缺失或日期非法 |
| `UNAUTHORIZED` | 401 | 未登录或 Token 无效（若启用鉴权） |
| `VOYAGE_NOT_FOUND` | 404 | 航次不存在 |
| `VOYAGE_ROUTE_UNAVAILABLE` | 404 | 航次存在但当前时间范围内无航线几何 |
| `INTERNAL_ERROR` | 500 | 服务器内部错误 |

`details` 可为对象，便于联调（如 `{ "field": "startDate" }`）。

### 1.5 成功响应包装（可选）

若项目统一使用信封：

```json
{
  "success": true,
  "data": { }
}
```

下文「响应」均指 `data` 载荷或裸 JSON，由项目组择一。

### 1.6 鉴权与演示环境（占位）

本组接口是否要求鉴权由**项目总规范**决定；本文档不强制一种方案，仅约定对齐方式：

| 模式 | 说明 |
|------|------|
| **Bearer Token** | 请求头 `Authorization: Bearer <token>`；`401` 时 body 仍使用 1.4 节错误结构，`code` 可为 `UNAUTHORIZED`。 |
| **会话 Cookie** | 由网关或同源 Cookie 自动携带；前端需 `credentials: 'include'`（若跨域则 CORS 需允许凭证）。 |
| **课程演示 / 本地** | 可约定**全部免鉴权**；须在 README 或部署说明中写明，避免联调时误配。 |

**跨域（CORS）**：前后端分离部署时，由后端为前端域名配置允许的 `Origin`、方法与头；若使用 Cookie，需显式允许凭证并固定 `Access-Control-Allow-Origin`（不可为 `*`）。

---

## 2. 类型定义（TypeScript 风格）

以下类型供前端与后端对齐；后端可用等价 Schema（OpenAPI / Zod 等）。

```ts
/** 航次唯一标识：全项目统一 string */
type VoyageId = string;

type EnvLayer = 'wind' | 'current' | 'wave';

interface ScatterItem {
  voyageId: VoyageId;
  /** 展示序号，从 1 起 */
  voyageIndex: number;
  /** 该航次总排放量 */
  totalEmission: number;
  /** 与 totalEmission 配套，如 "tCO2e" | "kgCO2e" */
  emissionUnit: string;
  /** 可选：tooltip */
  label?: string;
}

interface EnvironmentWeights {
  wind: number;
  current: number;
  wave: number;
}

/** 后端可返回已归一化权重，或原始正数；见接口说明 */
interface WeightsPayload {
  weights: EnvironmentWeights;
  /** 权重是否已归一化到和为 1 */
  normalized: boolean;
  computedAt: string;
}

/** GeoJSON LineString / MultiLineString 等，项目选一种固定 */
type GeoJSON = unknown;

interface VoyageRoutePayload {
  voyageId: VoyageId;
  geojson: GeoJSON;
  /** 可选：地图 fitBounds */
  bounds?: [number, number, number, number];
}

type TimeFilterPayload =
  | { mode: 'single_day'; startDay: string }
  | { mode: 'range'; startDay: string; endDay: string };

interface AnimationCheckRecordPayload {
  layer: EnvLayer;
  ok: boolean;
  reason?: string;
  timeFilter: TimeFilterPayload;
  selectedVoyageId?: string | null;
  clientBuild?: string;
}
```

---

## 3. 接口列表与前端函数映射

| 接口 | 用途 | 前端关联 |
|------|------|----------|
| `GET .../emissions-scatter` | 散点图数据 | `refreshDashboardData` |
| `GET .../environment/weights` | 饼图 | `refreshDashboardData` |
| `GET .../voyages/{voyageId}/route` | 地图航线几何 | `requestVoyageRouteSwitch` 后由地图或容器拉取 |
| `POST .../diagnostics/animation-check` | 写入 `check_animation` | `recordAnimationCheckFailure` |
| `POST .../map/layer` | 可选：服务端记录当前环境层 | `switchMapAnimation` 后可选调用 |
| `GET .../dashboard/snapshot` | 可选：聚合刷新 | `refreshDashboardData` 单请求优化 |
| `GET .../meta/data-latest-date` | 可选：`anchorDate` | 时间轴初始化 |

---

## 4. `GET /api/voyages/emissions-scatter`

### 4.1 说明

返回当前时间范围内各航次的排放量与序号，供散点图渲染；点击散点时用 `voyageId` 请求航线。

### 4.2 请求

| Query | 类型 | 必填 | 说明 |
|-------|------|------|------|
| `startDate` | `date` | 是 | 区间起 |
| `endDate` | `date` | 是 | 区间止 |

### 4.3 响应 `200`

```json
{
  "items": [
    {
      "voyageId": "v-20260401-001",
      "voyageIndex": 1,
      "totalEmission": 128.5,
      "emissionUnit": "tCO2e",
      "label": "航次 1"
    }
  ],
  "startDate": "2026-04-11",
  "endDate": "2026-04-17"
}
```

### 4.4 约束

- `items` 按 `voyageIndex` 升序。
- **编号**：默认 `voyageIndex` 在查询结果内为 **从 1 起的连续正整数**；若业务存在跳号，则返回实际序号即可，但须保证本次响应内 **`voyageId` 与 `voyageIndex` 一一对应**，与《功能文档》第 4.2 节策略一致。
- 空区间：`items: []`。

---

## 5. `GET /api/environment/weights`

### 5.1 说明

返回风/洋流/波浪权重，供饼图；**与 `startDate`/`endDate` 一致**，与功能文档「仅随 timeFilter 变化」对齐。

### 5.2 请求

| Query | 类型 | 必填 |
|-------|------|------|
| `startDate` | `date` | 是 |
| `endDate` | `date` | 是 |

### 5.3 可选扩展（若产品需要「按航次解释」）

| Query | 类型 | 必填 | 说明 |
|-------|------|------|------|
| `voyageId` | `string` | 否 | 若传入，返回该航次在区间内的解释性权重；不传则全局/聚合权重。 |

### 5.4 响应 `200`

```json
{
  "weights": {
    "wind": 0.5,
    "current": 0.3,
    "wave": 0.2
  },
  "normalized": true,
  "computedAt": "2026-04-17T08:00:00+08:00"
}
```

若 `normalized === false`，前端归一化规则：

\[
w_i' = \frac{w_i}{\sum_j w_j}
\]

（若和为 0，饼图显示空态或平均三等分，组内定一种。）

---

## 6. `GET /api/voyages/{voyageId}/route`

### 6.1 说明

返回指定航次航线几何，供中央大屏绘制；**可与时间范围无关**或**受时间过滤约束**，由后端业务决定，但须在响应中一致体现。

### 6.2 请求

路径参数：`voyageId`。

可选 Query（与统计口径一致时）：

| Query | 类型 | 说明 |
|-------|------|------|
| `startDate` | `date` | 若后端按区间裁剪轨迹，与当前 `timeFilter` 一致传入 |
| `endDate` | `date` | 同上 |

### 6.3 响应 `200`

```json
{
  "voyageId": "v-20260401-001",
  "geojson": {
    "type": "LineString",
    "coordinates": [[120.1, 36.2], [120.2, 36.3]]
  },
  "bounds": [119.5, 35.8, 121.0, 37.0]
}
```

### 6.4 错误

- `404` + `code: VOYAGE_NOT_FOUND`：无此航次。
- `404` + `code: VOYAGE_ROUTE_UNAVAILABLE`：有航次但无几何（地图空态）。

---

## 7. `POST /api/diagnostics/animation-check`

### 7.1 说明

当前端 `checkAnimation` 返回失败时调用，由**服务端**将记录追加或合并到 `check_animation.json`（路径可配置）；浏览器不直接写文件。

### 7.2 请求 Body

```json
{
  "layer": "wind",
  "ok": false,
  "reason": "layer_not_visible",
  "timeFilter": {
    "mode": "single_day",
    "startDay": "2026-04-17"
  },
  "selectedVoyageId": null,
  "clientBuild": "1.0.0"
}
```

| 字段 | 类型 | 必填 |
|------|------|------|
| `layer` | `EnvLayer` | 是 |
| `ok` | `boolean` | 是；失败场景下为 `false` |
| `reason` | `string` | 否 |
| `timeFilter` | `TimeFilterPayload` | 是 |
| `selectedVoyageId` | `string \| null` | 否 |
| `clientBuild` | `string` | 否 |

### 7.3 响应 `204` 或 `200`

无 body 或 `{ "success": true }`。

### 7.3.1 客户端错误处理（与功能文档一致）

- 若 `POST` 因网络或 5xx 失败：**不**作为动画自检「未开启」的依据；动画状态仍以 `checkAnimation` 为准。
- **用户提示**：正式环境建议静默；开发环境可打日志或轻提示。详见《功能文档》第 5.6 节。

### 7.4 服务端与 `check_animation.json`

**建议文件路径**（可配置）：`server/storage/check_animation.json`。

**建议结构**：顶层为对象，内含数组 `records`，便于并发时整文件替换或分段锁：

```json
{
  "version": 1,
  "records": [
    {
      "ts": "2026-04-17T14:58:29+08:00",
      "layer": "wind",
      "ok": false,
      "reason": "layer_not_visible",
      "timeFilter": {
        "mode": "single_day",
        "startDay": "2026-04-17"
      },
      "selectedVoyageId": null
    }
  ]
}
```

**并发**：写入时使用文件锁或队列串行化，避免多进程同时追加损坏 JSON。

---

## 8. `POST /api/map/layer`（可选）

### 8.1 说明

若环境切换**完全由前端地图**完成，本接口可选；用于服务端审计或与仿真服务同步。

### 8.2 请求 Body

```json
{
  "layer": "current"
}
```

### 8.3 响应

`204` 或 `200` + 空对象。

---

## 9. `GET /api/dashboard/snapshot`（可选）

### 9.1 说明

单次请求返回散点 + 权重等，减少 `refreshDashboardData` 内多次往返。

### 9.2 请求

| Query | 类型 | 必填 |
|-------|------|------|
| `startDate` | `date` | 是 |
| `endDate` | `date` | 是 |

### 9.3 响应 `200`（示例）

```json
{
  "scatter": {
    "items": []
  },
  "weights": {
    "weights": { "wind": 0.5, "current": 0.3, "wave": 0.2 },
    "normalized": true,
    "computedAt": "2026-04-17T08:00:00+08:00"
  }
}
```

字段可与第 4、5 节子结构复用，避免重复定义。

---

## 10. `GET /api/meta/data-latest-date`（可选）

### 10.1 说明

返回数据集最新自然日，供时间轴 `anchorDate`；若无则前端退化为本地「今天」。

### 10.2 响应 `200`

```json
{
  "latestDate": "2026-04-16"
}
```

---

## 11. 与前端函数的请求对应关系（汇总）

| 前端函数 | HTTP |
|----------|------|
| `refreshDashboardData(tf)` | `GET /api/voyages/emissions-scatter` + `GET /api/environment/weights`，或 `GET /api/dashboard/snapshot` |
| 地图加载航线（由地图适配器调用） | `GET /api/voyages/{voyageId}/route` |
| `recordAnimationCheckFailure(...)` | `POST /api/diagnostics/animation-check` |
| （可选）`switchMapAnimation` 后审计 | `POST /api/map/layer` |
| 初始化 `anchorDate` | `GET /api/meta/data-latest-date`（可选） |

---

## 12. OpenAPI / 文档维护

- 建议用 OpenAPI 3.x 从本文档生成机器可读规范；`EnvLayer`、`ScatterItem`、`TimeFilterPayload` 等抽为 `components/schemas`。
- 版本变更时同步更新功能文档中的默认值与区间语义。

---

*文档版本：与《航次钻取控制 — 功能文档》配套使用。*
