import { afterEach, describe, expect, it, vi } from "vitest";

import sitemap from "../sitemap";

describe("sitemap", () => {
  afterEach(() => {
    vi.doUnmock("./games/potion-timing/config");
    vi.resetModules();
  });

  it("includes the public broadcast catch-up hub", async () => {
    const entries = await sitemap();

    expect(entries.map((entry) => entry.url)).toContain("https://moingfans.com/broadcasts");
  });

  it("publishes the enabled game without changing existing routes", async () => {
    vi.doMock("./games/potion-timing/config", () => ({ POTION_GAME_ENABLED: true }));
    const { default: enabledSitemap } = await import("../sitemap");
    const urls = (await enabledSitemap()).map(entry => entry.url);
    expect(urls).toContain("https://moingfans.com/games/potion-timing");
    expect(urls).toContain("https://moingfans.com/");
    expect(urls).toContain("https://moingfans.com/broadcasts");
  });

  it("omits the game when disabled", async () => {
    vi.doMock("./games/potion-timing/config", () => ({ POTION_GAME_ENABLED: false }));
    const { default: disabledSitemap } = await import("../sitemap");
    expect((await disabledSitemap()).map(entry => entry.url))
      .not.toContain("https://moingfans.com/games/potion-timing");
  });
});
