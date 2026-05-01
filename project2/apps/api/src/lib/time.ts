import type { TimeFilter } from "../../../../shared/contracts.js";

export function isoToDay(iso: string): string {
  return iso.slice(0, 10);
}

export function ensureTimeFilter(timeFilter: TimeFilter): { startTs: string; endTs: string } {
  return {
    startTs: timeFilter.startTs,
    endTs: timeFilter.endTs ?? timeFilter.startTs
  };
}

export function normalizeTimeInput(value: string | undefined, fallback?: string): string {
  if (value) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }
  if (fallback) {
    return fallback;
  }
  throw new Error("Invalid time input");
}

export function timestampInRange(ts: string, startTs: string, endTs: string): boolean {
  return ts >= startTs && ts <= endTs;
}

export function buildTimeFilter(startTs: string, endTs?: string): TimeFilter {
  if (!endTs || endTs === startTs) {
    return { mode: "instant", startTs };
  }
  return { mode: "range", startTs, endTs };
}

export function slidingWindowDays(anchorDate: string, count: number): string[] {
  const base = new Date(`${anchorDate}T00:00:00+08:00`);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(base);
    date.setUTCDate(date.getUTCDate() - (count - index - 1));
    return date.toISOString().slice(0, 10);
  });
}
