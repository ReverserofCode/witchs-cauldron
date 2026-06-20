import fs from "node:fs";
import path from "node:path";
import { unstable_noStore as noStore } from "next/cache";
import { SectionCard } from "@/app/components/cards";
import ClipsViewer from "./ClipsViewer";
import YouTubeShortsViewer from "./YouTubeShortsViewer";

interface Clip {
  id: string;
  src: string;
  title: string;
}

const CLIPS_DIR = path.join(process.cwd(), "public", "clips");
const VIDEO_EXTENSIONS = [/\.mp4$/i, /\.webm$/i, /\.ogg$/i, /\.mov$/i];
const MAX_VISIBLE_CLIPS = 10;
const CLIP_FILE_PATTERN = /^clip_([^_]+)(?:_(.+))?$/;
const CLIP_ID_PATTERN = /^[A-Za-z0-9_-]{6,}$/;

function getClipTitle(filename: string, index: number): string {
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

function loadClipsFromDirectory(): Clip[] {
  let files: Array<{ name: string; mtimeMs: number }> = [];

  try {
    files = fs.readdirSync(CLIPS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isFile() && VIDEO_EXTENSIONS.some((pattern) => pattern.test(entry.name)))
      .map((entry) => {
        const fullPath = path.join(CLIPS_DIR, entry.name);
        const stat = fs.statSync(fullPath);
        return { name: entry.name, mtimeMs: stat.mtimeMs };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs);
  } catch (error) {
    return [];
  }

  return files.slice(0, MAX_VISIBLE_CLIPS).map(({ name: filename, mtimeMs }, index) => {
    const base = filename.replace(/\.[^.]+$/, "");
    const encodedFilename = encodeURIComponent(filename);

    return {
      id: `${base}-${Math.floor(mtimeMs)}`,
      src: `/clips/${encodedFilename}?v=${Math.floor(mtimeMs)}`,
      title: getClipTitle(filename, index),
    } satisfies Clip;
  });
}

export default function ClipsSection() {
  // Always render fresh clip list after collection (disable RSC caching)
  noStore();
  const clips = loadClipsFromDirectory();

  return (
    <SectionCard
      tone="lavender"
      eyebrow="Shorts"
      title="하이라이트 숏폼"
      description="치지직 클립과 YouTube Shorts를 한눈에"
      bodyClassName="gap-3"
    >
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* 치지직 클립 */}
        <div className="rounded-[20px] border border-purple-200/60 bg-white/60 p-3">
          <div className="mb-2.5 flex items-center justify-between gap-3 border-b border-purple-200/60 pb-2.5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-purple-700/70">
                Chzzk
              </p>
              <p className="mt-1 text-sm font-semibold text-purple-950">치지직 클립</p>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 px-3 py-1.5">
              <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              <span className="text-xs font-bold text-white">치지직</span>
            </div>
          </div>
          <ClipsViewer clips={clips} />
        </div>

        {/* 유튜브 Shorts */}
        <div className="rounded-[20px] border border-purple-200/60 bg-white/60 p-3">
          <div className="mb-2.5 flex items-center justify-between gap-3 border-b border-purple-200/60 pb-2.5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-purple-700/70">
                YouTube
              </p>
              <p className="mt-1 text-sm font-semibold text-purple-950">공식 Shorts</p>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-red-500 to-red-600 px-3 py-1.5">
              <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"/>
                <path fill="white" d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
              <span className="text-xs font-bold text-white">YouTube</span>
            </div>
          </div>
          <YouTubeShortsViewer />
        </div>
      </div>
    </SectionCard>
  );
}
