import type { SourceType } from "../../../../shared/contracts";

export function cnNumber(value: number, fractionDigits = 2): string {
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: fractionDigits
  }).format(value);
}

export function sourceBadgeLabel(sourceType: SourceType): string {
  if (sourceType === "real") return "真实";
  if (sourceType === "derived") return "推导";
  return "模拟";
}

export function metricDeltaLabel(delta: number): string {
  if (delta > 0) return `+${cnNumber(delta, 2)}`;
  return cnNumber(delta, 2);
}
