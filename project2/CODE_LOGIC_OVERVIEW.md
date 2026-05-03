# Code Logic Overview

## 1. Project Structure

This project is split into three main layers:

- `apps/web`
  Frontend React + Vite application. Responsible for page composition, chart interaction, map interaction, filtering, and calling backend APIs.
- `apps/api`
  Fastify backend. Responsible for reading generated voyage data, slicing time ranges, computing metrics, building map payloads, generating mock environment layers, and returning API responses.
- `shared`
  Shared TypeScript contracts between frontend and backend. Defines common payload types such as `DashboardSnapshot`, `EmissionSeriesPoint`, `RouteMetrics`, `RouteGeometryPayload`, and environment models.

Supporting data directories:

- `data/generated`
  Preprocessed real voyage outputs used by the API.
- `data/mock`
  Mock seeds for environment layers and auxiliary demo data.
- `tools/preprocess.ts`
  Offline preprocessing script that transforms raw AIS CSV files into generated JSON datasets.

## 2. Frontend Logic

### 2.1 Entry and Orchestration

Main file:

- `apps/web/src/App.tsx`

Responsibilities:

- Fetches dashboard snapshot, voyage series, route geometry, route metrics, environment layer, and environment weights via React Query.
- Holds local scatter filters:
  - `scatterOriginFilter`
  - `scatterDestinationFilter`
- Reads and updates shared UI state from Zustand store:
  - `envLayer`
  - `selectedVoyageId`
  - `selectedPortPair`
  - `selectedTimestamp`
- Composes the main panels:
  - Scatter panel
  - Environment mix panel
  - Time-series panel group
  - Map panel
  - Chord panel
  - Detail panel
  - Route comparison panel

Important flow:

1. Load dashboard snapshot.
2. User selects a voyage from scatter chart.
3. `selectedVoyageId` updates in the store.
4. Frontend requests:
   - emission series
   - map route
   - route metrics
   - dynamic environment weights
5. User clicks a point in one of the trend charts.
6. `selectedTimestamp` updates.
7. All linked views react to the same selected timestamp.

### 2.2 Shared UI State

Main file:

- `apps/web/src/store/dashboard-store.ts`

Store fields:

- `timeFilter`
- `envLayer`
- `selectedVoyageId`
- `selectedPortPair`
- `selectedTimestamp`
- `dataSource`
- `initialized`

Important rules:

- Changing selected voyage resets `selectedTimestamp`.
- Changing time filter resets selected voyage, selected timestamp, selected port pair, and source.
- `setSelectedTimestamp` drives cross-chart and map time linkage.

### 2.3 API Client Layer

Main file:

- `apps/web/src/lib/api.ts`

Responsibilities:

- Wraps all frontend HTTP requests.
- Encodes optional time-range query parameters.
- Exposes typed functions such as:
  - `getDashboardSnapshot`
  - `getRoute`
  - `getEmissionSeries`
  - `getMetrics`
  - `getEnvironmentLayer`
  - `getEnvironmentWeights`
  - `getPortPairVoyages`
  - `recordAnimationCheck`

## 3. Frontend Panels

### 3.1 Scatter Panel

Main file:

- `apps/web/src/components/ScatterPanel.tsx`

Responsibilities:

- Displays voyage emission intensity scatter plot.
- Groups voyages by route label (`origin -> destination`).
- Applies jitter to reduce point overlap:
  - `xJitter`
  - `yJitter`
- Builds route-based color mapping.
- Uses origin/destination dropdowns for filtering.
- Clicking a point selects a voyage.

Notable logic:

- X axis is numeric, but labels are converted back into route names through `axisLabel.formatter`.
- Tooltip shows voyage ID, emission intensity, total emission, and distance.
- Axis `onZero` is disabled to avoid a vertical axis line appearing in the middle of the plot.

### 3.2 Weights Panel

Main file:

- `apps/web/src/components/WeightsPanel.tsx`

Responsibilities:

- Renders an ECharts donut chart for environment mix.
- Uses dynamic weights returned by backend.
- Displays three layers:
  - Wind
  - Current
  - Wave

Current behavior:

- Weights change with selected voyage when available.
- Legend and pie labels are arranged to avoid overlap.

### 3.3 Series Panels

Main file:

- `apps/web/src/components/SeriesPanels.tsx`

Contains three linked charts:

- `Emission Trend`
- `Speed Trend`
- `Cumulative Delta`

Key internal helper logic:

- `trimEdgePoints(points)`
  Removes leading and trailing abnormal spikes from emission-related display data.
- `samplePoints(points, maxPoints)`
  Downsamples dense series into representative buckets.
- `getChartPoints(points)`
  Standardizes chart input so all three charts share the same displayed time points.
- `findClosestPoint(points, selectedTimestamp)`
  Finds the nearest chart point to the global selected timestamp.

Current interaction model:

- Hover does not trigger cross-panel updates.
- Clicking any chart point sets the global selected timestamp.
- The three charts stay time-aligned by using the same `getChartPoints()` output.

Chart-specific logic:

- Emission Trend
  - Displays actual vs predicted emission at each sampled time point.
  - Dynamically rescales Y axis.
  - Uses trimmed + sampled points to suppress edge spikes.
- Speed Trend
  - Displays actual vs predicted speed.
  - Uses the same aligned chart points as the other charts.
  - Dynamically rescales Y axis.
- Cumulative Delta
  - Now visualizes cumulative actual emission vs cumulative predicted emission.
  - The header still shows current delta summary from the selected point.

Legend behavior:

- Legend is displayed in each chart header.
- Legend text includes current selected numeric values.
- Real and Predicted values are shown after legend labels instead of floating on top of the chart.

### 3.4 Map Panel

Main file:

- `apps/web/src/components/MapPanel.tsx`

Responsibilities:

- Shows selected voyage route and environment overlay.
- Displays:
  - actual AIS route
  - ideal/reference route
- Reads selected timestamp and passes selection callback into map layer.
- Displays active point speed in caption.

### 3.5 Chord Panel

Main file:

- `apps/web/src/components/ChordPanel.tsx`

Responsibilities:

- Renders port-to-port flow relationships with D3 chord diagram.
- Builds a directed chord matrix from `PortFlow[]`.
- Clicking a ribbon selects the corresponding port pair.

Current label behavior:

- Port names are rendered inside each colored arc.
- Labels are horizontally oriented and centered in the arc region.

### 3.6 Metrics Panel

Main file:

- `apps/web/src/components/MetricsPanel.tsx`

Responsibilities:

- Displays actual vs reference comparisons for:
  - duration
  - distance
  - average speed
  - max speed
  - total emission
  - emission per NM

Important logic:

- Each metric card uses its own local maximum for bar-length normalization.
- This avoids large metrics flattening small ones visually.

### 3.7 Detail Panel

Main file:

- `apps/web/src/components/DetailPanel.tsx`

Responsibilities:

- Displays selected point details:
  - actual position / speed / emission
  - ideal position / speed / emission
  - current and cumulative delta

## 4. Backend Logic

### 4.1 Fastify App

Main file:

- `apps/api/src/app.ts`

Responsibilities:

- Registers Fastify and CORS.
- Maps HTTP routes to service functions in `data-store.ts`.

Key endpoints:

- `GET /api/dashboard/snapshot`
- `GET /api/voyages/emissions-scatter`
- `GET /api/voyages/:voyageId/route`
- `GET /api/voyages/:voyageId/emission-series`
- `GET /api/voyages/:voyageId/metrics`
- `GET /api/port-flows`
- `GET /api/port-flows/:source/:target/voyages`
- `GET /api/environment/weights`
- `GET /api/environment/layers/:layer`
- `POST /api/diagnostics/animation-check`

### 4.2 Data Store Service

Main file:

- `apps/api/src/services/data-store.ts`

This is the main backend business-logic file.

Responsibilities:

- Load and cache generated dataset files.
- Slice voyage series by time range.
- Build dashboard snapshot.
- Build scatter data.
- Build route geometry payloads.
- Build route metrics payloads.
- Build dynamic environment weights.
- Build environment layer vector fields.

## 5. Backend Data Flow

### 5.1 Dataset Loading and Cache

Key functions:

- `loadDataset()`
- `getDataset()`

Behavior:

- Reads `real-data.json`, mock voyage seeds, port flow seeds, and environment seeds.
- Uses generated file `mtimeMs` as dataset version.
- Reloads only when generated data changes.

### 5.2 Time-Range Helpers

Key functions:

- `getDatasetTimeRange(real)`
- `getSlice(series, timeFilter)`
- `voyageIntersectsTimeFilter(voyage, timeFilter)`

Behavior:

- Normalizes raw time bounds.
- Filters voyage series to current window.
- Ensures snapshot and detail payloads only include relevant data.

### 5.3 Scatter and Summary Building

Key functions:

- `summaryFromVoyage()`
- `buildScatter()`

Behavior:

- Summarizes per-voyage metrics from filtered series.
- Sorts voyages by `startTs`.
- Assigns display `voyageIndex`.

### 5.4 Port Flow Aggregation

Key function:

- `buildPortFlows()`

Behavior:

- Aggregates real voyages by `origin -> destination`.
- Produces counts and associated `voyageIds`.

## 6. Route, Series, and Metrics Logic

### 6.1 Route Geometry

Key function:

- `buildRouteGeometry()`

Behavior:

- Converts current slice into:
  - `actualRoute`
  - `referenceRoute`
- Computes marker for selected timestamp.
- Computes actual route summary metrics.
- Includes best derived routes when available.
- Returns map bounds covering all displayed routes.

### 6.2 Emission Series

Key function:

- `getVoyageEmissionSeries()`

Behavior:

- Loads voyage detail.
- Applies time slicing.
- Returns raw aligned `EmissionSeriesPoint[]`.

### 6.3 Route Metrics

Key function:

- `buildRouteMetricsFromSlice()`

Behavior:

- Computes actual and reference:
  - distance
  - duration
  - average speed
  - max speed
  - total emission
  - emission per NM
- Computes delta for each metric item.

## 7. Environment Logic

### 7.1 Environment Layer Field

Key function:

- `getEnvironmentLayer(layer, ts)`

Behavior:

- Uses mock seed parameters to generate vector fields on a regular grid.
- Returns vectors with:
  - `lon`
  - `lat`
  - `u`
  - `v`
  - `intensity`

This layer is still synthetic, but deterministic for a given time and layer.

### 7.2 Dynamic Environment Weights

Key functions:

- `getEnvironmentVectorAtPoint()`
- `computeEnvironmentWeightsFromSeries()`
- `computeVoyageEnvironmentWeights()`
- `normalizeEnvironmentWeights()`
- `getEnvironmentWeights()`

Current algorithm:

For each voyage segment:

1. Compute segment distance.
2. Generate wind/current/wave vector at the segment point.
3. Compute route direction vector.
4. Compute alignment between route direction and environment vector.
5. Compute speed deviation factor:
   `1 + min(|actualSpeed - standardSpeed| / max(standardSpeed, 1), 1.5)`
6. Accumulate per-layer contribution:

`segmentDistance × (intensity + vectorMagnitude) × directionalFactor × speedDeviationFactor`

Directional factor:

- `wave`: `0.85 + 0.15 * alignment`
- `wind/current`: `0.35 + 0.65 * alignment`

If a specific voyage is selected:

- backend returns dynamic derived weights from the voyage series

If no voyage is selected:

- backend falls back to `seededWeights()`

## 8. Preprocessing and Data Origins

Preprocessing entry:

- `tools/preprocess.ts`

High-level role:

- Reads raw AIS CSV files.
- Reconstructs voyage-level sequences.
- Generates summary JSON and detailed per-voyage JSON files.

Generated outputs consumed by backend:

- `data/generated/real-data.json`
- `data/generated/voyages/*.json`

## 9. Current Interaction Rules

- Scatter click selects voyage.
- Chord ribbon click selects port pair.
- Trend chart click selects timestamp.
- Timestamp selection links:
  - three trend charts
  - map marker
  - detail panel
- Environment weight chart updates with selected voyage.

## 10. Known Current UI/Logic Conventions

- Trend charts use aligned, downsampled chart points for readability.
- Emission chart suppresses abnormal edge spikes before plotting.
- Trend legends show selected numeric values instead of floating point labels inside the chart.
- Scatter chart disables axis crossing at zero to avoid a vertical axis line through the plot.
- Cumulative chart currently represents cumulative actual emission vs cumulative predicted emission.

## 11. Suggested Files to Read First

If you want to understand the project quickly, read in this order:

1. `shared/contracts.ts`
2. `apps/api/src/app.ts`
3. `apps/api/src/services/data-store.ts`
4. `apps/web/src/App.tsx`
5. `apps/web/src/store/dashboard-store.ts`
6. `apps/web/src/components/SeriesPanels.tsx`
7. `apps/web/src/components/ScatterPanel.tsx`
8. `apps/web/src/components/MapPanel.tsx`
9. `apps/web/src/components/ChordPanel.tsx`
10. `apps/web/src/components/MetricsPanel.tsx`

