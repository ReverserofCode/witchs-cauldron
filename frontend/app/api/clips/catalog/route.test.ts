import { beforeEach, describe, expect, it, vi } from "vitest";

const getClipCatalog = vi.fn();

vi.mock("@/app/lib/clips/catalog", () => ({
  getClipCatalog,
}));

describe("GET /api/clips/catalog", () => {
  beforeEach(() => {
    getClipCatalog.mockResolvedValue({
      clips: [
        {
          id: "clip-demo-1000",
          src: "/clips/clip_demo.mp4?v=1000",
          title: "데모 클립",
        },
      ],
      generatedAt: "2026-07-11T00:00:00.000Z",
      version: "catalog-v1",
    });
  });

  it("returns a cacheable catalog with an ETag", async () => {
    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/clips/catalog"));

    expect(response.status).toBe(200);
    expect(response.headers.get("etag")).toBe('W/"catalog-v1"');
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=15, stale-while-revalidate=45"
    );
    await expect(response.json()).resolves.toMatchObject({ version: "catalog-v1" });
  });

  it("returns 304 when the client already has the current catalog", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/clips/catalog", {
        headers: { "if-none-match": 'W/"catalog-v1"' },
      })
    );

    expect(response.status).toBe(304);
    expect(await response.text()).toBe("");
  });
});
