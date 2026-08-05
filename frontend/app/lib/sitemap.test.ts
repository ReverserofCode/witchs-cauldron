import { describe, expect, it } from "vitest";

import sitemap from "../sitemap";

describe("sitemap", () => {
  it("includes the public broadcast catch-up hub", async () => {
    const entries = await sitemap();

    expect(entries.map((entry) => entry.url)).toContain("https://moingfans.com/broadcasts");
  });
});
