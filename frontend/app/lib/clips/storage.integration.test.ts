import fs from "node:fs/promises";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getClipOpenFlags } from "./storage";

type ClipCatalogGlobal = typeof globalThis & {
  __witchsClipCatalogCache?: unknown;
};

const bakedClipsDirectory = path.join(process.cwd(), "public", "clips");
const cleanupPaths = new Set<string>();
let previousSharedClipsDirectory: string | undefined;
let sharedClipsDirectory = "";

async function writeTestClip(filePath: string, contents: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, contents);
  cleanupPaths.add(filePath);
}

async function requestClip(
  filenameParts: string[],
  { method = "GET", range }: { method?: "GET" | "HEAD"; range?: string } = {}
) {
  const { GET, HEAD } = await import("../../media/clips/[...filename]/route");
  const encodedPath = filenameParts.map(encodeURIComponent).join("/");
  const request = new NextRequest(`http://localhost/media/clips/${encodedPath}`, {
    method,
    headers: range ? { range } : undefined,
  });

  return (method === "HEAD" ? HEAD : GET)(request, {
    params: Promise.resolve({ filename: filenameParts }),
  });
}

beforeEach(async () => {
  previousSharedClipsDirectory = process.env.SHARED_CLIPS_DIR;
  sharedClipsDirectory = await fs.mkdtemp(
    path.join(process.cwd(), ".clip-storage-test-")
  );
  process.env.SHARED_CLIPS_DIR = sharedClipsDirectory;
  delete (globalThis as ClipCatalogGlobal).__witchsClipCatalogCache;
  vi.resetModules();
});

afterEach(async () => {
  if (previousSharedClipsDirectory === undefined) {
    delete process.env.SHARED_CLIPS_DIR;
  } else {
    process.env.SHARED_CLIPS_DIR = previousSharedClipsDirectory;
  }

  await Promise.all(
    [...cleanupPaths].map((filePath) => fs.rm(filePath, { force: true }))
  );
  cleanupPaths.clear();
  await fs.rm(sharedClipsDirectory, { force: true, recursive: true });
  delete (globalThis as ClipCatalogGlobal).__witchsClipCatalogCache;
  vi.resetModules();
});

describe("clip storage integration", () => {
  it("uses no-follow file opening when the runtime supports it", () => {
    expect(getClipOpenFlags({ O_RDONLY: 0, O_NOFOLLOW: 0x20000 })).toBe(0x20000);
    expect(getClipOpenFlags({ O_RDONLY: 0 })).toBe(0);
  });

  it("serves a shared clip before a baked clip with the same filename", async () => {
    const filename = `clip_storage_priority_${process.pid}.mp4`;
    await writeTestClip(path.join(bakedClipsDirectory, filename), "baked");
    await writeTestClip(path.join(sharedClipsDirectory, filename), "shared");

    const response = await requestClip([filename]);

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("shared");
  });

  it("falls back to a baked clip when the shared directory lacks it", async () => {
    const filename = `clip_storage_fallback_${process.pid}.mp4`;
    await writeTestClip(path.join(bakedClipsDirectory, filename), "baked-only");

    const response = await requestClip([filename]);

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("baked-only");
  });

  it("serves byte ranges from the securely opened descriptor", async () => {
    const filename = `clip_storage_range_${process.pid}.mp4`;
    await writeTestClip(path.join(sharedClipsDirectory, filename), "0123456789");

    const response = await requestClip([filename], { range: "bytes=2-5" });

    expect(response.status).toBe(206);
    expect(response.headers.get("content-range")).toBe("bytes 2-5/10");
    await expect(response.text()).resolves.toBe("2345");
  });

  it("answers HEAD without streaming a response body", async () => {
    const filename = `clip_storage_head_${process.pid}.mp4`;
    await writeTestClip(path.join(sharedClipsDirectory, filename), "head-only");

    const response = await requestClip([filename], { method: "HEAD" });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-length")).toBe("9");
    expect(response.body).toBeNull();
  });

  it("rejects traversal outside every configured clip directory", async () => {
    const filename = `clip_storage_secret_${process.pid}.mp4`;
    await writeTestClip(path.join(process.cwd(), "public", filename), "secret");

    const response = await requestClip(["..", filename]);

    expect(response.status).toBe(400);
  });

  it("rejects nested paths because the clip catalog only contains flat filenames", async () => {
    const response = await requestClip(["nested", "clip.mp4"]);

    expect(response.status).toBe(400);
  });

  it("merges shared and baked catalog entries with shared duplicates taking priority", async () => {
    const sharedOnlyName = `clip_storage_shared_${process.pid}.mp4`;
    const duplicateName = `clip_storage_duplicate_${process.pid}.mp4`;
    const sharedOnlyPath = path.join(sharedClipsDirectory, sharedOnlyName);
    const sharedDuplicatePath = path.join(sharedClipsDirectory, duplicateName);
    const bakedDuplicatePath = path.join(bakedClipsDirectory, duplicateName);

    await writeTestClip(sharedOnlyPath, "shared-only");
    await writeTestClip(sharedDuplicatePath, "shared-duplicate");
    await writeTestClip(bakedDuplicatePath, "baked-duplicate");
    await fs.utimes(sharedOnlyPath, new Date("2099-01-01T00:00:01.000Z"), new Date("2099-01-01T00:00:01.000Z"));
    await fs.utimes(sharedDuplicatePath, new Date("2099-01-01T00:00:02.000Z"), new Date("2099-01-01T00:00:02.000Z"));
    await fs.utimes(bakedDuplicatePath, new Date("2099-01-01T00:00:03.000Z"), new Date("2099-01-01T00:00:03.000Z"));

    const sharedDuplicateStat = await fs.stat(sharedDuplicatePath);
    const { getClipCatalog } = await import("./catalog");
    const snapshot = await getClipCatalog({ force: true });
    const sharedOnlyClips = snapshot.clips.filter((clip) =>
      clip.src.includes(encodeURIComponent(sharedOnlyName))
    );
    const duplicateClips = snapshot.clips.filter((clip) =>
      clip.src.includes(encodeURIComponent(duplicateName))
    );

    expect(sharedOnlyClips).toHaveLength(1);
    expect(duplicateClips).toHaveLength(1);
    expect(duplicateClips[0].src).toBe(
      `/media/clips/${encodeURIComponent(duplicateName)}?v=${Math.floor(sharedDuplicateStat.mtimeMs)}`
    );
  });
});
