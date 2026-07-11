import { describe, expect, it, vi } from "vitest";

import {
  buildClipCatalog,
  createClipCatalogCache,
  type ClipFileInfo,
} from "./catalog";

const files: ClipFileInfo[] = [
  { name: "clip_older123_예전_클립.mp4", mtimeMs: 1_000 },
  { name: "clip_newer456_마녀의-원본_클립_이름.mp4", mtimeMs: 2_000 },
  { name: "notes.txt", mtimeMs: 3_000 },
];

describe("clip catalog", () => {
  it("sorts video files by modification time and exposes their original title", () => {
    const clips = buildClipCatalog(files);

    expect(clips).toHaveLength(2);
    expect(clips[0]).toMatchObject({
      title: "마녀의 원본 클립 이름",
      src: "/clips/clip_newer456_%EB%A7%88%EB%85%80%EC%9D%98-%EC%9B%90%EB%B3%B8_%ED%81%B4%EB%A6%BD_%EC%9D%B4%EB%A6%84.mp4?v=2000",
    });
    expect(clips[1].title).toBe("예전 클립");
  });

  it("uses a stable fallback when a filename contains only a clip id", () => {
    const clips = buildClipCatalog([
      { name: "clip_abcd1234.mp4", mtimeMs: 1_000 },
    ]);

    expect(clips[0].title).toBe("치지직 하이라이트 #1");
  });

  it("reuses a cached scan until the TTL expires", async () => {
    let now = 10_000;
    const scan = vi.fn(async () => files);
    const cache = createClipCatalogCache({ scan, ttlMs: 100, now: () => now });

    const first = await cache.get();
    const second = await cache.get();
    now += 101;
    const third = await cache.get();

    expect(scan).toHaveBeenCalledTimes(2);
    expect(second).toBe(first);
    expect(third).not.toBe(first);
    expect(third.clips).toEqual(first.clips);
  });

  it("deduplicates concurrent directory scans", async () => {
    let releaseScan: ((value: ClipFileInfo[]) => void) | undefined;
    const scan = vi.fn(
      () => new Promise<ClipFileInfo[]>((resolve) => {
        releaseScan = resolve;
      })
    );
    const cache = createClipCatalogCache({ scan, ttlMs: 100 });

    const first = cache.get();
    const second = cache.get();
    releaseScan?.(files);

    await expect(first).resolves.toBe(await second);
    expect(scan).toHaveBeenCalledTimes(1);
  });

  it("keeps the last valid catalog when a refresh fails", async () => {
    let now = 10_000;
    const scan = vi
      .fn<() => Promise<ClipFileInfo[]>>()
      .mockResolvedValueOnce(files)
      .mockRejectedValueOnce(new Error("temporary read failure"));
    const cache = createClipCatalogCache({ scan, ttlMs: 100, now: () => now });

    const first = await cache.get();
    now += 101;
    const fallback = await cache.get();

    expect(fallback).toBe(first);
    expect(scan).toHaveBeenCalledTimes(2);
  });
});
