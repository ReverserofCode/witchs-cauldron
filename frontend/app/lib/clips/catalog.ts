import { createHash } from "node:crypto";

import {
  isVideoClipFilename,
  scanClipDirectories,
  type ClipFileInfo,
} from "./storage";

export type { ClipFileInfo } from "./storage";

export type ClipCatalogItem = {
  id: string;
  src: string;
  title: string;
};

export type ClipCatalogSnapshot = {
  clips: ClipCatalogItem[];
  generatedAt: string;
  version: string;
};

type ClipCatalogCacheOptions = {
  scan: () => Promise<ClipFileInfo[]>;
  ttlMs?: number;
  now?: () => number;
  maxClips?: number;
};

type GetCatalogOptions = {
  force?: boolean;
};

const CLIP_FILE_PATTERN = /^clip_([^_]+)(?:_(.+))?$/;
const CLIP_ID_PATTERN = /^[A-Za-z0-9_-]{6,}$/;
const DEFAULT_CACHE_TTL_MS = 30_000;
const DEFAULT_MAX_CLIPS = 10;
const FAILED_REFRESH_RETRY_MS = 5_000;

function compareFileInfo(left: ClipFileInfo, right: ClipFileInfo) {
  if (left.mtimeMs !== right.mtimeMs) return right.mtimeMs - left.mtimeMs;
  return left.name < right.name ? -1 : left.name > right.name ? 1 : 0;
}

function getClipTitle(filename: string, index: number) {
  const base = filename.replace(/\.[^.]+$/, "");
  const clipMatch = base.match(CLIP_FILE_PATTERN);
  const rawTitle = clipMatch ? clipMatch[2] ?? "" : base;
  const cleanName = rawTitle
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleanName || CLIP_ID_PATTERN.test(cleanName)) {
    return `치지직 하이라이트 #${index + 1}`;
  }

  return cleanName;
}

export function buildClipCatalog(
  files: ClipFileInfo[],
  maxClips = DEFAULT_MAX_CLIPS
): ClipCatalogItem[] {
  const safeMaxClips = Math.max(0, Math.trunc(maxClips));

  const uniqueFiles = new Map<string, ClipFileInfo>();
  for (const file of files) {
    if (isVideoClipFilename(file.name) && !uniqueFiles.has(file.name)) {
      uniqueFiles.set(file.name, file);
    }
  }

  return [...uniqueFiles.values()]
    .sort(compareFileInfo)
    .slice(0, safeMaxClips)
    .map(({ name, mtimeMs }, index) => {
      const base = name.replace(/\.[^.]+$/, "");
      const version = Math.floor(mtimeMs);

      return {
        id: `${base}-${version}`,
        src: `/media/clips/${encodeURIComponent(name)}?v=${version}`,
        title: getClipTitle(name, index),
      };
    });
}

function buildSnapshot(clips: ClipCatalogItem[], timestamp: number): ClipCatalogSnapshot {
  const version = createHash("sha1")
    .update(JSON.stringify(clips))
    .digest("hex")
    .slice(0, 16);

  return {
    clips,
    generatedAt: new Date(timestamp).toISOString(),
    version,
  };
}

export function createClipCatalogCache({
  scan,
  ttlMs = DEFAULT_CACHE_TTL_MS,
  now = Date.now,
  maxClips = DEFAULT_MAX_CLIPS,
}: ClipCatalogCacheOptions) {
  const safeTtlMs = Math.max(1, Math.trunc(ttlMs));
  let current: ClipCatalogSnapshot | null = null;
  let expiresAt = 0;
  let inFlight: Promise<ClipCatalogSnapshot> | null = null;

  const refresh = async () => {
    try {
      const files = await scan();
      const timestamp = now();
      current = buildSnapshot(buildClipCatalog(files, maxClips), timestamp);
      expiresAt = timestamp + safeTtlMs;
      return current;
    } catch (error) {
      const timestamp = now();
      expiresAt = timestamp + Math.min(safeTtlMs, FAILED_REFRESH_RETRY_MS);

      if (current) return current;

      console.warn("[clip-catalog] Failed to scan clips directory", error);
      current = buildSnapshot([], timestamp);
      return current;
    } finally {
      inFlight = null;
    }
  };

  return {
    get({ force = false }: GetCatalogOptions = {}) {
      if (!force && current && now() < expiresAt) return Promise.resolve(current);
      if (inFlight) return inFlight;

      inFlight = refresh();
      return inFlight;
    },
  };
}

type ClipCatalogGlobal = typeof globalThis & {
  __witchsClipCatalogCache?: ReturnType<typeof createClipCatalogCache>;
};

function getDefaultCache() {
  const cacheGlobal = globalThis as ClipCatalogGlobal;
  cacheGlobal.__witchsClipCatalogCache ??= createClipCatalogCache({
    scan: scanClipDirectories,
  });
  return cacheGlobal.__witchsClipCatalogCache;
}

export function getClipCatalog(options?: GetCatalogOptions) {
  return getDefaultCache().get(options);
}
