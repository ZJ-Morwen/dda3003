import type { SourceType } from "../../../../shared/contracts";
import { sourceBadgeLabel } from "../lib/format";

interface BadgeProps {
  sourceType: SourceType;
}

export function Badge({ sourceType }: BadgeProps) {
  return <span className={`badge badge-${sourceType}`}>{sourceBadgeLabel(sourceType)}</span>;
}
