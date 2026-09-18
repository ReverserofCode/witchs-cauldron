import { describe, expect, it, vi } from "vitest";
import { createFanArtCatalog, parseCatalog, mergeGalleryImages } from "./catalog";

const image = { id: "06ad7945-e58c-44e1-b2f0-af1585da4e0c", src: "/media/fanart/06ad7945-e58c-44e1-b2f0-af1585da4e0c", alt: "작품", credit: "작가", sourceUrl: "https://cafe.naver.com/moinge/123", publishedAt: "2026-09-18T00:00:00.000Z" };
describe("published fanart client catalog", () => {
  it("rejects remote images and unsafe source links instead of displaying them", () => {
    expect(() => parseCatalog({ images: [{ ...image, src: "https://attacker.invalid/a.png" }] })).toThrow();
    expect(() => parseCatalog({ images: [{ ...image, sourceUrl: "javascript:alert(1)" }] })).toThrow();
    expect(parseCatalog({ images: [image] })).toEqual([image]);
  });
  it("does not mark legacy images as reviewed when merging", () => {
    expect(mergeGalleryImages([image], [{ src: "/rightAside/old.png", alt: "기존 작품" }])).toEqual([image, { src: "/rightAside/old.png", alt: "기존 작품" }]);
  });
  it("deduplicates concurrent refreshes and preserves the approved list on failure", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ images: [image] })).mockRejectedValueOnce(new Error("offline"));
    const catalog = createFanArtCatalog(fetcher);
    await Promise.all([catalog.refresh(), catalog.refresh()]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(catalog.getSnapshot()).toEqual([image]);
    await catalog.refresh();
    expect(catalog.getSnapshot()).toEqual([image]);
  });
  it("removes withdrawn images on a successful empty refresh", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ images: [image] })).mockResolvedValueOnce(Response.json({ images: [] }));
    const catalog = createFanArtCatalog(fetcher);
    await catalog.refresh();
    await catalog.refresh();
    expect(catalog.getSnapshot()).toEqual([]);
  });
});
