import type { TimeFilter } from "../../../../shared/contracts.js";

export function isoToDay(iso: string): string {
  return iso.slice(0, 10);
}

export function ensureTimeFilter(timeFilter: TimeFilter): { startDay: string; endDay: string } {
  return {
    startDay: timeFilter.startDay,
    endDay: timeFilter.endDay ?? timeFilter.startDay
  };
}

export function normalizeDateInput(value: string | undefined, fallback?: string): string {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  if (fallback) {
    return fallback;
  }
  throw new Error("Invalid date input");
}

export function dayInRange(day: string, startDay: string, endDay: string): boolean {
  return day >= startDay && day <= endDay;
}

export function buildTimeFilter(startDay: string, endDay?: string): TimeFilter {
  if (!endDay || endDay === startDay) {
    return { mode: "single_day", startDay };
  }
  return { mode: "range", startDay, endDay };
}

export function slidingWindowDays(anchorDate: string, count: number): string[] {
  const base = new Date(`${anchorDate}T00:00:00+08:00`);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(base);
    date.setUTCDate(date.getUTCDate() - (count - index - 1));
    return date.toISOString().slice(0, 10);
  });
}
