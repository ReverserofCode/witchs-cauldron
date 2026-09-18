import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createFanArtAssetStore } from "./assets";

describe("fanart asset storage", () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "fanart-assets-"));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it("decodes a real raster, bounds its dimensions, strips metadata, and writes a generated WebP key", async () => {
    const input = await sharp({
      create: { width: 2400, height: 1200, channels: 3, background: "#a020f0" },
    }).withMetadata({ exif: { IFD0: { Artist: "private artist metadata" } } }).png().toBuffer();
    const store = createFanArtAssetStore(directory);

    const asset = await store.save(input);
    const saved = await readFile(join(directory, asset.key));
    const metadata = await sharp(saved).metadata();

    expect(asset.key).toMatch(/^[0-9a-f-]{36}\.webp$/);
    expect(asset).toMatchObject({ width: 1600, height: 800, bytes: saved.length });
    expect(asset.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(metadata.format).toBe("webp");
    expect(metadata.exif).toBeUndefined();
    await expect(store.readVerified(asset)).resolves.toEqual(saved);
  });

  it.each([
    ["SVG", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100"/></svg>')],
    ["GIF", Buffer.from("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", "base64")],
    ["disguised text", Buffer.from("this is not an image")],
  ])("rejects %s input even if an upload labels it as an image", async (_label, input) => {
    const store = createFanArtAssetStore(directory);
    await expect(store.save(input)).rejects.toMatchObject({ code: "invalid_image", status: 400 });
  });

  it("rejects decoded images over the pixel budget before resizing", async () => {
    const oversized = await sharp({
      create: { width: 5000, height: 5000, channels: 3, background: "#ffffff" },
    }).png().toBuffer();
    const store = createFanArtAssetStore(directory);

    await expect(store.save(oversized)).rejects.toMatchObject({ code: "image_too_large", status: 413 });
  });

  it("fails closed when a saved file no longer matches the catalog hash", async () => {
    const input = await sharp({
      create: { width: 100, height: 100, channels: 3, background: "#000000" },
    }).png().toBuffer();
    const store = createFanArtAssetStore(directory);
    const asset = await store.save(input);
    const tampered = { ...asset, sha256: "f".repeat(64) };

    await expect(store.readVerified(tampered)).resolves.toBeNull();
  });
});
