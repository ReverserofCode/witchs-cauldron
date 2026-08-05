import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const nextConfig = require("../../next.config.js") as {
  rewrites?: () =>
    | Promise<{ beforeFiles?: Array<{ source: string; destination: string }> }>
    | { beforeFiles?: Array<{ source: string; destination: string }> };
};

describe("Next.js routing compatibility", () => {
  it("routes legacy clip URLs through the shared-first media handler before public files", async () => {
    const rewrites = await nextConfig.rewrites?.();

    expect(rewrites?.beforeFiles).toContainEqual({
      source: "/clips/:path*",
      destination: "/media/clips/:path*",
    });
  });
});
