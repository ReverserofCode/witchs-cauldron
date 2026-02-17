import fs from "node:fs";
import path from "node:path";

export interface FanArtImage {
  src: string;
  alt: string;
  download?: string;
  credit?: string;
}

const FAN_ART_DIR = path.join(process.cwd(), "public", "rightAside");
const IMAGE_EXTENSIONS = [/\.png$/i, /\.jpe?g$/i, /\.webp$/i, /\.gif$/i];

export function loadFanArtImages(): FanArtImage[] {
  let files: string[] = [];

  try {
    files = fs
      .readdirSync(FAN_ART_DIR, { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isFile() &&
          IMAGE_EXTENSIONS.some((pattern) => pattern.test(entry.name))
      )
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b, "ko"));
  } catch {
    return [];
  }

  return files.map((filename) => {
    const base = filename.replace(/\.[^.]+$/, "");
    const readable = base
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return {
      src: `/rightAside/${filename}`,
      alt:
        readable.length > 0
          ? `모잉 팬아트 ${readable}`
          : "모잉 팬아트 이미지",
    } satisfies FanArtImage;
  });
}
