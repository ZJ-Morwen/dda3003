import { describe, expect, it } from "vitest";

import { buildMedianProfile, buildMockVoyages } from "./build-dataset.js";
import { parseLineStringWkt } from "./geo.js";

describe("geo and dataset helpers", () => {
  it("parses WKT line strings", () => {
    expect(parseLineStringWkt("LINESTRING(117.1 39.1,118.2 38.5)")).toEqual([
      [117.1, 39.1],
      [118.2, 38.5]
    ]);
  });

  it("builds a median reference profile", () => {
    const profile = buildMedianProfile([
      [
        { ts: "2025-09-01T00:00:00+08:00", lat: 39, lon: 117, speed: 10, heading: null, cog: null },
        { ts: "2025-09-01T01:00:00+08:00", lat: 38, lon: 118, speed: 14, heading: null, cog: null }
      ],
      [
        { ts: "2025-09-01T00:00:00+08:00", lat: 39, lon: 117, speed: 12, heading: null, cog: null },
        { ts: "2025-09-01T01:00:00+08:00", lat: 38, lon: 118, speed: 16, heading: null, cog: null }
      ]
    ], 4);
    expect(profile).toHaveLength(4);
    expect(profile[0]).toBe(11);
    expect(profile[3]).toBe(15);
  });

  it("keeps mock voyages isolated as mock source type", () => {
    const voyages = buildMockVoyages(
      [
        {
          voyageId: "mock-1",
          label: "Mock 1",
          source: "Shanghai",
          target: "Ningbo",
          startTs: "2025-09-25T08:00:00+08:00",
          intervalMinutes: 20,
          coordinates: [
            [121.4, 31.2],
            [121.6, 30.7],
            [121.5, 29.9]
          ],
          speeds: [12, 13, 12]
        }
      ],
      97
    );
    expect(voyages[0].sourceType).toBe("mock");
    expect(voyages[0].voyageIndex).toBe(98);
  });
});
