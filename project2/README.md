# Multi-Port AIS Visualization Platform

This project is an interactive visual analytics system for large-scale AIS voyage data. It preprocesses cleaned AIS CSV files into voyage-level JSON datasets, then serves an interactive dashboard for exploring routes, emission patterns, and port-to-port traffic.

The project is organized as a TypeScript full-stack application:

- `apps/web`: React + Vite frontend
- `apps/api`: Fastify backend
- `shared`: shared TypeScript contracts
- `tools`: preprocessing scripts
- `cleaned_ais_data`: cleaned AIS CSV input files
- `data/generated`: generated voyage datasets used by the backend
- `data/support`: support data for environment-related visualization layers

## Data Provenance

This project combines three kinds of data:

- `Real data`
  The AIS trajectory records in `cleaned_ais_data/*.csv` are the primary real data source.

- `Derived data`
  Voyage summaries, reference routes, reference speed profiles, and predicted low-emission routes are derived from the real AIS trajectories during preprocessing.

- `Environment support data`
  The wind/current/wave environment layers and some fallback environment weights are used as supporting environmental context for visualization and interaction.

Important clarification:

- The displayed emission value is an `Emission Index` / `score`.
- It is a relative analytical metric for comparison.
- It is not a direct physical CO2 measurement.

## Dataset Scale

Current project scale:

- Raw AIS input files: `7`
- Raw AIS points: about `1,585,744`
- Input size on disk: about `198.866 MB`
- Generated voyage count: `450`
- Generated dataset size: about `481.103 MB`

This makes the project large enough to require non-trivial preprocessing, aggregation, route reconstruction, and interaction design.

## Main Views

- `Voyage Emission Overview`
  Scatter plot of voyage-level emission distribution across port pairs.

- `Route Map`
  Map view of the selected actual AIS route and its reference route.

- `Environment Mix`
  Relative wind/current/wave influence summary for the selected voyage or time window.

- `Emission Trend`
  Time-series view of actual versus reference emission score.

- `Speed Trend`
  Time-series view of actual versus reference speed.

- `Cumulative Emission Index`
  Cumulative comparison between actual and reference emission score.

- `Actual vs Reference Route`
  Summary metrics comparing actual and reference voyage behavior.

- `Port Flow`
  Port-to-port movement summary derived from real voyages.

- `Point Detail`
  Detailed values for the selected time point.

## Installation

Run all commands from the project root:

```powershell
cd project2
```

Install dependencies:

```powershell
npm install
```

Preprocess the AIS CSV files:

```powershell
npm run preprocess
```

Optional validation commands:

```powershell
npm run build:api
npm run build:web
npm run test:api
npm run test:web
```

## Execution

Start the backend:

```powershell
cd project2
npm run dev:api
```

Backend URL:

- `http://127.0.0.1:8787`

Start the frontend in another terminal:

```powershell
cd project2
npm run dev:web
```

Frontend URL:

- usually `http://127.0.0.1:5173`
- if `5173` is occupied, use the URL shown by Vite in the terminal

## Demo Flow

1. Open the frontend in a browser.
2. Wait for the dashboard snapshot to load.
3. Select a voyage from the scatter plot.
4. Inspect the map, metrics panel, and time-series panels.
5. Click a point in the time series to trigger coordinated updates across linked views.

## Notes and Limitations

- The AIS voyage data is real, but it is cleaned and preprocessed before visualization.
- Some route endpoints are snapped to known port centers to improve route consistency.
- Reference routes are model-derived and should not be interpreted as ground truth.
- Environment-related layers are included as supporting context for visualization.
- Chart views may sample or trim dense points for readability and interaction performance.

## User Guide

The concise user guide required for submission is provided in:

- `README.txt`
