import type { SourceType } from "../../../../shared/contracts";

export function cnNumber(value: number, fractionDigits = 2): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: fractionDigits
  }).format(value);
}

export function sourceBadgeLabel(sourceType: SourceType): string {
  if (sourceType === "real") return "Real";
  if (sourceType === "derived") return "Derived";
  return "Mock";
}

export function metricDeltaLabel(delta: number): string {
  if (delta > 0) return `+${cnNumber(delta, 2)}`;
  return cnNumber(delta, 2);
}
