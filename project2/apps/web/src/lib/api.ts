import type {
  DashboardSnapshot,
  EmissionSeriesPoint,
  EnvironmentFieldPayload,
  RouteGeometryPayload,
  RouteMetrics,
  ScatterItem,
  TimeFilter,
  VoyageSummary
} from "../../../../shared/contracts";

async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error((payload as { message?: string }).message ?? "Request failed");
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

function toRange(timeFilter: TimeFilter): { startTs: string; endTs: string } {
  return {
    startTs: timeFilter.startTs,
    endTs: timeFilter.endTs ?? timeFilter.startTs
  };
}

function withOptionalRange(
  query: URLSearchParams,
  timeFilter?: TimeFilter
): URLSearchParams {
  if (!timeFilter) {
    return query;
  }
  const range = toRange(timeFilter);
  query.set("startTs", range.startTs);
  query.set("endTs", range.endTs);
  return query;
}

export async function getDashboardSnapshot(startDate?: string, endDate?: string): Promise<DashboardSnapshot> {
  const query = new URLSearchParams();
  if (startDate) query.set("startTs", startDate);
  if (endDate) query.set("endTs", endDate);
  return fetchJson<DashboardSnapshot>(`/api/dashboard/snapshot?${query.toString()}`);
}

export async function getRoute(
  voyageId: string,
  options?: { timeFilter?: TimeFilter; ts?: string }
): Promise<RouteGeometryPayload> {
  const query = withOptionalRange(new URLSearchParams(), options?.timeFilter);
  if (options?.ts) {
    query.set("ts", options.ts);
  }
  return fetchJson<RouteGeometryPayload>(`/api/voyages/${voyageId}/route?${query.toString()}`);
}

export async function getEmissionSeries(
  voyageId: string,
  timeFilter?: TimeFilter
): Promise<{ voyageId: string; sourceType: "real" | "mock" | "derived"; points: EmissionSeriesPoint[] }> {
  const query = withOptionalRange(new URLSearchParams(), timeFilter);
  return fetchJson(`/api/voyages/${voyageId}/emission-series?${query.toString()}`);
}

export async function getMetrics(voyageId: string, timeFilter?: TimeFilter): Promise<RouteMetrics> {
  const query = withOptionalRange(new URLSearchParams(), timeFilter);
  return fetchJson(`/api/voyages/${voyageId}/metrics?${query.toString()}`);
}

export async function getEnvironmentLayer(
  layer: "wind" | "current" | "wave",
  ts: string
): Promise<EnvironmentFieldPayload> {
  const query = new URLSearchParams({ ts });
  return fetchJson(`/api/environment/layers/${layer}?${query.toString()}`);
}

export async function getPortPairVoyages(
  source: string,
  target: string,
  timeFilter: TimeFilter
): Promise<{ source: string; target: string; items: VoyageSummary[] }> {
  const query = new URLSearchParams(toRange(timeFilter));
  return fetchJson(`/api/port-flows/${source}/${target}/voyages?${query.toString()}`);
}

export async function recordAnimationCheck(payload: unknown): Promise<void> {
  await fetchJson("/api/diagnostics/animation-check", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

export type {
  DashboardSnapshot,
  EmissionSeriesPoint,
  EnvironmentFieldPayload,
  RouteGeometryPayload,
  RouteMetrics,
  ScatterItem,
  VoyageSummary
};
