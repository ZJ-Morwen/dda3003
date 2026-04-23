import { describe, expect, it } from "vitest";

import { metricDeltaLabel, sourceBadgeLabel } from "./format";

describe("format helpers", () => {
  it("formats source badges in Chinese", () => {
    expect(sourceBadgeLabel("real")).toBe("真实");
    expect(sourceBadgeLabel("derived")).toBe("推导");
    expect(sourceBadgeLabel("mock")).toBe("模拟");
  });

  it("formats positive delta values with sign", () => {
    expect(metricDeltaLabel(12.5)).toContain("+");
    expect(metricDeltaLabel(-3.2)).toContain("-");
  });
});
