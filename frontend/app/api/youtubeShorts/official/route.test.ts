import { afterEach, describe, expect, it, vi } from "vitest";

describe("GET /api/youtubeShorts/official", () => {
  afterEach(() => {
    delete process.env.YOUTUBE_API_KEY;
    vi.resetModules();
  });

  it("returns an empty list with 200 when YOUTUBE_API_KEY is missing", async () => {
    delete process.env.YOUTUBE_API_KEY;

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([]);
  });
});
