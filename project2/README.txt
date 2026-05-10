README.txt

1) DESCRIPTION

This package is a multi-port AIS voyage visualization and analysis system. It reads cleaned AIS trajectory CSV files, preprocesses them into structured JSON datasets, and presents the results through an interactive web dashboard. The system helps users explore voyages between major Chinese ports, inspect route geometry, compare actual and reference routes, and observe relative emission patterns across voyages.

The project is organized as a full-stack TypeScript application. The backend is built with Fastify and is responsible for loading generated voyage data, computing dashboard summaries, serving route and metric APIs, and returning environment-related layers and weights used in the demo. The frontend is built with React and Vite, and provides coordinated views such as an emission scatter plot, time-series charts, a route map, metric panels, and port-flow visualizations.

The package combines three kinds of data. First, the AIS trajectory records in `cleaned_ais_data/` are the primary real data source. Second, voyage summaries, reference routes, reference speed profiles, and predicted low-emission routes are derived from the real AIS trajectories during preprocessing. Third, the wind/current/wave layers and some fallback environment weights are used as supporting environmental context for visualization and interaction.

For demonstration purposes, the package already includes cleaned AIS input data under `cleaned_ais_data/`, generated voyage data under `data/generated/`, and environment support data under `data/support/`. After preprocessing and launch, the demo allows the user to select voyages, inspect their emissions and speeds over time, view actual versus reference routes, and explore port-to-port traffic patterns. The displayed emission value is an `Emission Index` / `score`, which is a relative analytical metric for comparison rather than a direct physical CO2 measurement.


2) INSTALLATION

Requirements:
- Node.js 18 or newer is recommended.
- npm is required.
- A Windows PowerShell terminal was used for development and testing.

Project root:
- Open a terminal and move to the project root directory:

  `cd project2`

Install dependencies:
- Run the following command in the project root:

  `npm install`

Prepare the generated dataset:
- Before running the system, preprocess the AIS CSV files:

  `npm run preprocess`

What this step does:
- Reads the AIS CSV files from `cleaned_ais_data/`
- Groups points into voyages
- Builds generated JSON outputs for backend use
- Prepares route, metric, and demo visualization data
- Derives reference routes and comparison profiles from historical AIS voyages

Optional verification commands:
- `npm run build:api`
- `npm run build:web`
- `npm run test:api`
- `npm run test:web`


3) EXECUTION

To run the demo, start the backend first and then the frontend.

Step 1: start the backend API
- In the project root, run:

  `npm run dev:api`

- The backend serves the API at:

  `http://127.0.0.1:8787`

Step 2: start the frontend
- Open a second terminal.
- Move to the same project root:

  `cd project2`

- Run:

  `npm run dev:web`

- The frontend is usually available at:

  `http://127.0.0.1:5173`

- If port `5173` is already in use, Vite may automatically switch to another port such as `5174`. In that case, open the URL shown in the terminal output.

Step 3: use the demo
- Open the frontend URL in a browser.
- Wait for the dashboard snapshot to load.
- Select a voyage from the scatter plot.
- Inspect the route map, emission series, speed series, cumulative emission index, and route comparison panels.
- Click time points in the charts to see linked updates across the map and detail panels.

Expected demo behavior:
- The scatter plot shows voyage-level emission distribution.
- The map displays the actual AIS route and a reference route.
- Metric panels compare voyage indicators.
- Port-flow views summarize movements between ports.
- Environment-related panels show the relative effect of wind/current/wave layers used in the visualization.

Important notes for interpretation:
- The AIS voyages are based on real cleaned AIS input data.
- The reference or predicted route is derived from historical voyages and should not be interpreted as ground truth.
- The environment layers are included as supporting environmental context for visualization.
- The emission values are relative scores, not direct measured emissions.


4) DEMO VIDEO

An unlisted 1-minute demo video URL is optional according to the submission requirement.

Current status:
- Demo video URL not included in this file.

If needed, the recommended video should show:
- opening the terminal
- running `npm install`
- running `npm run preprocess`
- starting the backend with `npm run dev:api`
- starting the frontend with `npm run dev:web`
- opening the browser and demonstrating one example voyage
