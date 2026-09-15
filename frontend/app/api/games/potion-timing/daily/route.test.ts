import { afterEach, describe, expect, it, vi } from "vitest";

const CONFIG_PATH = "../../../../lib/games/potion-timing/config";

describe("GET /api/games/potion-timing/daily", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.doUnmock(CONFIG_PATH);
    vi.resetModules();
  });

  it("returns 404 while the source feature switch is disabled", async () => {
    const { GET } = await import("./route");

    const response = await GET();

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
  });

  it("returns the server-dated challenge without cache when enabled", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T12:34:56Z"));
    vi.doMock(CONFIG_PATH, () => ({ POTION_GAME_ENABLED: true }));
    const { GET } = await import("./route");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store, max-age=0");
    expect(body).toMatchObject({
      serverNowMs: Date.parse("2026-09-15T12:34:56Z"),
      challenge: {
        challengeId: "potion-v1:2026-09-15:daily",
        date: "2026-09-15",
        rulesVersion: "potion-v1",
        startsAtMs: Date.parse("2026-09-15T00:00:00Z"),
        endsAtMs: Date.parse("2026-09-16T00:00:00Z"),
      },
    });
    expect(body.challenge.rounds).toHaveLength(5);
  });
});
