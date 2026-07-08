import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const query = vi.fn();
const ensureSchema = vi.fn();
const getPool = vi.fn(async () => ({ query }));

vi.mock("../db", () => ({
  ensureSchema,
  getPool,
}));

describe("GET /api/analytics/stats", () => {
  beforeEach(() => {
    query.mockReset();
    ensureSchema.mockReset();
    getPool.mockClear();
  });

  it("rejects KST date ranges longer than 366 days before querying analytics data", async () => {
    const { GET } = await import("./route");
    const request = new NextRequest("http://localhost/api/analytics/stats?from=2025-01-01&to=2026-01-02");

    const response = await GET(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "range_too_large",
      maxRangeDays: 366,
    });
    expect(ensureSchema).not.toHaveBeenCalled();
    expect(getPool).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });
});
