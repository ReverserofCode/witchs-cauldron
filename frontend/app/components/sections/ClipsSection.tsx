import fs from "node:fs";
import path from "node:path";
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

function loadClipsFromDirectory(): Clip[] {
  let files: string[] = [];

  try {
    files = fs.readdirSync(CLIPS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isFile() && VIDEO_EXTENSIONS.some((pattern) => pattern.test(entry.name)))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b, "ko"));
  } catch (error) {
    return [];
  }

  return files.map((filename, index) => {
    const base = filename.replace(/\.[^.]+$/, "");
    const encodedFilename = encodeURIComponent(filename);
    const cleanName = base
      .replace(/^clip_/, "")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return {
      id: base,
      src: `/clips/${encodedFilename}`,
      title: cleanName.length > 0 ? `${cleanName}` : `하이라이트 클립 #${index + 1}`,
    } satisfies Clip;
  });
}

export default function ClipsSection() {
  const clips = loadClipsFromDirectory();

  return (
    <SectionCard
      tone="lavender"
      className="shadow-md rounded-2xl border-white/40 bg-gradient-to-br from-purple-100/70 via-white/70 to-white/90 shadow-purple-900/15"
      eyebrow="Shorts"
      title="하이라이트 숏폼"
      description="치지직 클립과 YouTube Shorts를 한눈에"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
        {/* 치지직 클립 */}
        <div className="flex flex-col">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full">
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              <span className="text-xs font-bold text-white">치지직</span>
            </div>
          </div>
          <ClipsViewer clips={clips} />
        </div>

        {/* 유튜브 Shorts */}
        <div className="flex flex-col">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-red-500 to-red-600 rounded-full">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
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
