import { describe, expect, it } from "vitest";

import { buildApp } from "./app.js";

describe("api app", () => {
  it("returns latest available date metadata", async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/meta/data-latest-date"
    });
    expect(response.statusCode).toBe(200);
    const payload = response.json() as {
      latestDate: string;
      dateRange: { start: string; end: string };
    };
    expect(payload.latestDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(payload.dateRange.start <= payload.dateRange.end).toBe(true);
    await app.close();
  });

  it("serves port flow data including the real Tianjin-Qingdao pair", async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/port-flows?startDate=2025-09-29&endDate=2025-09-30"
    });
    expect(response.statusCode).toBe(200);
    const payload = response.json() as {
      items: Array<{ source: string; target: string; sourceType: string }>;
    };
    expect(
      payload.items.some(
        (item) =>
          item.source === "Tianjin" &&
          item.target === "Qingdao" &&
          item.sourceType === "real"
      )
    ).toBe(true);
    await app.close();
  });
});
