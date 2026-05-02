import { describe, expect, it } from "vitest";

import { metricDeltaLabel, sourceBadgeLabel } from "./format";

describe("format helpers", () => {
  it("formats source badges in English", () => {
    expect(sourceBadgeLabel("real")).toBe("Real");
    expect(sourceBadgeLabel("derived")).toBe("Derived");
    expect(sourceBadgeLabel("mock")).toBe("Mock");
  });

  it("formats positive delta values with sign", () => {
    expect(metricDeltaLabel(12.5)).toContain("+");
    expect(metricDeltaLabel(-3.2)).toContain("-");
  });
});
