import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("GET /api/channelStats", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({}),
    } as Response);
  });

  afterEach(() => {
    delete process.env.YOUTUBE_API_KEY;
    global.fetch = originalFetch;
    vi.resetModules();
  });

  it("returns partial stats with 200 when YOUTUBE_API_KEY is missing", async () => {
    delete process.env.YOUTUBE_API_KEY;

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      youtube: {
        moing: null,
        fullmoing: null,
      },
      chzzk: {
        followerCount: null,
      },
    });
  });
});
