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
- Open the frontend URL in a browser and wait for the dashboard snapshot to finish loading.
- Begin with the `Voyage Emission Overview` scatter plot, which is the main entry point for selecting voyages for analysis.
- Use the `Origin Port` and `Destination Port` dropdown menus to filter the voyage set by port pair before selecting a specific case.
- Once the filters are applied, the scatter plot updates immediately and retains only voyages that belong to the selected route.
- This filtering stage is important because it supports comparison within the same operational context rather than across unrelated port pairs.
- In the scatter plot, each point represents one voyage.
- The horizontal grouping corresponds to the route or port pair.
- The vertical position represents the relative `Emission Index per NM`.
- Hovering over a scatter point opens a tooltip that reports the voyage ID, total emission index, emission index per nautical mile, and voyage distance.
- Clicking a scatter point selects that voyage and updates all linked panels in the dashboard.
- After a voyage is selected, the left side of the interface displays three coordinated time-series views:
- `Emission Trend`
- `Speed Trend`
- `Cumulative Emission Index`
- These three charts are time-aligned, meaning that they all describe the same voyage timeline and correspond to the same ordered timestamps.
- Hovering over any line chart reveals detailed values for the selected time position and allows direct comparison between the actual curve and the reference or predicted curve.
- Clicking a single point in a chart selects that timestamp as the active analytical moment.
- Once a timestamp is selected, the map context and the `Point Detail` panel update to the same moment automatically.
- The charts also support interval-based inspection.
- Click one point in the chart as the start time.
- Click a second point as the end time.
- After the second click, the system creates a selected time interval, highlights that interval in the line charts, and simultaneously highlights the corresponding segment of the voyage trajectory on the map.
- The highlighted map segment is shown for both the actual AIS route and the corresponding reference route, so the user can compare actual and reference movement during the same time window.
- The start and end of the selected actual route segment are also marked visually on the map, making the selected interval easier to interpret.
- If a different interval is required, click `Clear Range` to remove the current selection and start again.
- The central `Route Map` shows only the currently selected voyage, which keeps the spatial display focused and avoids overlap with unrelated trajectories.
- The map displays both the actual AIS route and the matched reference or ideal route.
- Hovering over route lines reveals route-level summary information, including distance, average speed, total emission index, and emission index per nautical mile.
- Hovering over port markers reveals supporting metadata such as port name, region, role, and location.
- The map also supports time-based interaction.
- Clicking an AIS point on the map selects the corresponding timestamp directly.
- Clicking near the route selects the nearest voyage point, allowing the map and charts to be used together for detailed spatio-temporal inspection.
- Above the map, the environment-layer controls allow the user to switch the visualisation between `wind` and `current`.
- This control changes only the environmental field displayed in the background and does not change the selected voyage or the active time context.
- On the right side, the `Point Detail` panel provides the numerical values associated with the current timestamp.
- These values include actual position, actual speed, actual emission, reference position, reference speed, reference emission, instantaneous delta, and cumulative delta.
- The `Port Flow Chord Diagram` summarises the broader movement structure between ports in the dataset and provides route-network context beyond the selected voyage.
- The `Environment Mix` panel summarises the relative influence of wind, current, and wave factors in the current analytical context.
- The status and metric panels provide a concise summary of the selected port pair, selected voyage, visible voyage count after filtering, and cumulative emission gap at the active point.
- A recommended demonstration sequence is to filter by origin and destination ports, select one voyage in the scatter plot, inspect detailed values by hovering over the charts, define a start and end time in the charts, observe the highlighted segment on the map, and finally switch between `wind` and `current` to compare environmental context.

Expected demo behavior:
- The scatter plot shows voyage-level emission distribution and supports filtering by origin port and destination port.
- Hovering over a scatter point reveals summary information for one voyage.
- Clicking a scatter point selects one voyage and updates the linked dashboard panels.
- The map displays the actual AIS route and a reference route for the selected voyage.
- Hovering over the charts reveals detailed values for actual and reference curves at the same timestamp.
- The three line charts stay synchronized on the same voyage timeline.
- Clicking a single chart point updates the active timestamp used by the map and detail panel.
- Clicking one chart point as a start and another as an end creates a time interval selection.
- The selected time interval is highlighted in the charts.
- The corresponding actual and reference route segments are highlighted on the map.
- Clicking AIS points on the map can also update the active timestamp.
- Metric panels compare voyage indicators for the selected case.
- Port-flow views summarize movements between ports.
- Environment-related panels show the relative effect of wind/current/wave layers used in the visualization.
- The map layer can be switched between wind and current without changing the selected voyage.

Important notes for interpretation:
- The AIS voyages are based on real cleaned AIS input data.
- The reference or predicted route is derived from historical voyages and should not be interpreted as ground truth or as an operationally optimal navigation instruction.
- The environment layers are included as supporting environmental context for visualization and interaction, not as a full physical simulation of marine weather or ocean dynamics.
- The emission values shown in the system are relative analytical scores, not direct measured emissions or exact CO2 inventory values.
- A higher `Emission Index` should therefore be interpreted as relatively higher modeled emission burden in this demo, rather than as an exact real-world physical emission quantity.


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
