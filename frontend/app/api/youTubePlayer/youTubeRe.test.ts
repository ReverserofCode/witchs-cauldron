import { afterEach, describe, expect, it, vi } from "vitest";

describe("GET /api/youTubePlayer", () => {
  afterEach(() => {
    delete process.env.YOUTUBE_API_KEY;
    vi.resetModules();
  });

  it("returns empty payload with 200 when YOUTUBE_API_KEY is missing", async () => {
    delete process.env.YOUTUBE_API_KEY;

    const { GET } = await import("./youTubeRe");
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      moing: [],
      fullmoing: [],
      moingFan: [],
      error: "MISSING_API_KEY",
    });
  });
});
