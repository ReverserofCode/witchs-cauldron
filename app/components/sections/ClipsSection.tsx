import fs from "node:fs";
import path from "node:path";
import { SectionCard } from "@/app/components/cards";
import ClipsViewer from "./ClipsViewer";

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
    // 폴더가 없거나 읽기 실패 시 빈 배열을 반환
    return [];
  }

  return files.map((filename, index) => {
    const base = filename.replace(/\.[^.]+$/, "");
    const cleanName = base
      .replace(/^clip_/, "") // clip_ 접두사 제거
      .replace(/[_-]+/g, " ") // 언더스코어와 하이픈을 공백으로
      .replace(/\s+/g, " ") // 중복 공백 정리
      .trim();

    return {
      id: base,
      src: `/clips/${filename}`,
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
      eyebrow="Highlights"
      title="치지직 클립 모음"
      description="팬들이 선정한 최고의 하이라이트 순간들"
    >
      <ClipsViewer clips={clips} />
    </SectionCard>
  );
}