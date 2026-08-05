import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";

export type ClipFileInfo = {
  name: string;
  mtimeMs: number;
};

export type ClipPathResolution =
  | { status: "found"; path: string; root: string }
  | { status: "invalid" }
  | { status: "not-found" };

type ClipOpenConstants = {
  O_RDONLY: number;
  O_NOFOLLOW?: number;
};

type ClipDirectoryOptions = {
  cwd?: string;
  sharedClipsDir?: string;
};

const VIDEO_EXTENSION_PATTERN = /\.(?:mp4|webm|ogg|mov)$/i;

export function getClipOpenFlags(constants: ClipOpenConstants) {
  return constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0);
}

export function isVideoClipFilename(filename: string) {
  return VIDEO_EXTENSION_PATTERN.test(filename);
}

export function getClipDirectories({
  cwd = process.cwd(),
  sharedClipsDir = process.env.SHARED_CLIPS_DIR,
}: ClipDirectoryOptions = {}) {
  const bakedDirectory = path.resolve(cwd, "public", "clips");
  const candidates = sharedClipsDir?.trim()
    ? [path.resolve(cwd, sharedClipsDir), bakedDirectory]
    : [bakedDirectory];
  const seen = new Set<string>();

  return candidates.filter((directory) => {
    const key = process.platform === "win32" ? directory.toLowerCase() : directory;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function scanClipDirectory(directory: string): Promise<ClipFileInfo[]> {
  let entries;
  try {
    entries = await fsPromises.readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }

  const files = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && isVideoClipFilename(entry.name))
      .map(async (entry) => {
        try {
          const stat = await fsPromises.stat(path.join(directory, entry.name));
          return { name: entry.name, mtimeMs: stat.mtimeMs } satisfies ClipFileInfo;
        } catch {
          return null;
        }
      })
  );

  return files.filter((file): file is ClipFileInfo => file !== null);
}

export async function scanClipDirectories(
  directories = getClipDirectories()
): Promise<ClipFileInfo[]> {
  const directoryFiles = await Promise.all(
    directories.map((directory) => scanClipDirectory(directory))
  );

  return directoryFiles.flat();
}

function isWithinDirectory(directory: string, candidate: string) {
  const relative = path.relative(directory, candidate);
  return Boolean(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function hasSafePathParts(filenameParts: string[]) {
  return filenameParts.length === 1 && filenameParts.every((part) =>
    Boolean(part) &&
    part !== "." &&
    part !== ".." &&
    !part.includes("/") &&
    !part.includes("\\") &&
    !part.includes("\0") &&
    !path.isAbsolute(part)
  );
}

export function resolveClipPath(
  filenameParts: string[],
  directories = getClipDirectories()
): ClipPathResolution {
  if (!hasSafePathParts(filenameParts)) return { status: "invalid" };

  for (const directory of directories) {
    const root = path.resolve(directory);
    const candidate = path.resolve(root, ...filenameParts);
    if (!isWithinDirectory(root, candidate)) return { status: "invalid" };

    try {
      if (!fs.statSync(candidate).isFile()) continue;

      const realRoot = fs.realpathSync(root);
      const realCandidate = fs.realpathSync(candidate);
      if (!isWithinDirectory(realRoot, realCandidate)) continue;

      return { status: "found", path: candidate, root };
    } catch {
      continue;
    }
  }

  return { status: "not-found" };
}
