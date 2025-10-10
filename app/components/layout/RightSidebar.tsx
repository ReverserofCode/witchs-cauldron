import fs from "node:fs";
import path from "node:path";
import Image from "next/image";
import { type ReactElement } from "react";
import { SectionCard } from "@/app/components/cards";

interface FanArtImage {
  src: string;
  alt: string;
  download?: string;
  credit?: string;
}

interface RightSidebarProps {
  className?: string;
  images?: FanArtImage[];
}

const COMMUNITY_LINKS = [
  {
    label: "치지직 채널",
    href: "https://chzzk.naver.com/1d333ff175b4db5bd06f87a88579ec1e",
    description: "실시간 방송과 지난 라이브를 확인하세요.",
  },
  {
    label: "유튜브",
    href: "https://www.youtube.com/channel/UCHzre37UF4o64HRhp-7CDzQ",
    description: "공식 하이라이트와 신규 콘텐츠를 만나보세요.",
  },
  {
    label: "유튜브 다시보기",
    href: "https://www.youtube.com/@fullmoing",
    description: "LIVE 다시보기를 편하게 감상하세요.",
  },
  {
    label: "팬카페",
    href: "https://cafe.naver.com/moinge",
    description: "팬들과 소식을 나누고 팬아트를 제출해 보세요.",
  },
];

const FAN_ART_DIR = path.join(process.cwd(), "public", "rightAside");
const IMAGE_EXTENSIONS = [/\.png$/i, /\.jpe?g$/i, /\.webp$/i, /\.gif$/i];

function loadFanArtImages(): FanArtImage[] {
  let files: string[] = [];

  try {
    files = fs.readdirSync(FAN_ART_DIR, { withFileTypes: true })
      .filter((entry) => entry.isFile() && IMAGE_EXTENSIONS.some((pattern) => pattern.test(entry.name)))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b, "ko"));
  } catch (error) {
    // 폴더가 없거나 읽기 실패 시 빈 배열을 반환해 팬카페 안내 문구가 보여지도록 합니다.
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
      alt: readable.length > 0 ? `모잉 팬아트 ${readable}` : "모잉 팬아트 이미지",
    } satisfies FanArtImage;
  });
}

export default function RightSidebar({ className, images }: RightSidebarProps = {}): ReactElement {
  const defaultGallery = loadFanArtImages();
  const gallery = images && images.length > 0 ? images : defaultGallery;
  const hasGallery = gallery.length > 0;

  return (
    <aside
      className={[
        "flex h-full w-full max-w-[200px] flex-col gap-4 rounded-3xl border border-white/15 bg-white/10 p-4 shadow-lg shadow-purple-950/20 backdrop-blur-lg lg:max-w-[220px] xl:max-w-[240px]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <SectionCard
        tone="neutral"
        className="shadow-md rounded-2xl border-white/40 bg-white/88 shadow-purple-900/10"
        bodyClassName="gap-3"
        eyebrow="Community"
        title="모잉 커뮤니티"
        description="팬들과 함께하는 공식 채널"
      >
        <ul className="flex flex-col gap-2 text-[11px] text-purple-900/85">
          {COMMUNITY_LINKS.map((link) => (
            <li key={link.href} className="px-3 py-2 border shadow-sm rounded-xl border-purple-200/60 bg-white/70">
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col gap-1 transition-colors hover:text-[rgb(var(--moing-deep))]"
              >
                <span className="text-xs font-semibold text-purple-950/95">{link.label}</span>
                <span className="text-[10px] text-purple-700/80">{link.description}</span>
              </a>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard
        tone="lavender"
        className="flex-1 shadow-md rounded-2xl border-white/40 bg-white/60 shadow-purple-900/10"
        bodyClassName="gap-5"
        eyebrow="Fan Art"
        title="마녀의 작업실"
        description="팬들의 참여로 꾸며지는 갤러리입니다."
      >
        {hasGallery ? (
          <div className="flex flex-col gap-6">
            {gallery.map((item, index) => (
              <figure key={item.src} className="flex flex-col gap-3">
                <div className="relative overflow-hidden border shadow-lg rounded-2xl border-white/40 shadow-purple-900/20">
                  <Image
                    src={item.src}
                    alt={item.alt}
                    width={320}
                    height={420}
                    className="object-cover w-full h-full"
                    sizes="(min-width: 1280px) 240px, (min-width: 1024px) 200px, 100vw"
                    priority={index === 0}
                  />
                </div>
                {item.credit && <figcaption className="text-[11px] text-purple-900/70">{item.credit}</figcaption>}
                <div className="flex items-center justify-between text-[11px] text-purple-900/60">
                  <span>
                    {index + 1} / {gallery.length}
                  </span>
                  {item.download && (
                    <a href={item.download} download className="btn btn-primary h-8 min-w-[5rem] justify-center text-xs">
                      다운로드
                    </a>
                  )}
                </div>
              </figure>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3 text-[11px] text-purple-900/75">
            <p>아직 등록된 팬아트가 없습니다. 팬카페에 작품을 공유하면 이곳에 소개됩니다.</p>
            <a
              href="https://cafe.naver.com/moinge"
              target="_blank"
              rel="noopener noreferrer"
              className="justify-center text-xs btn btn-primary h-9"
            >
              팬아트 업로드 가이드 보기
            </a>
          </div>
        )}
      </SectionCard>
    </aside>
  );
}
