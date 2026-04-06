import { type ReactElement } from "react";
import { SectionCard } from "@/app/components/cards";
import { FanArtGallery } from "@/app/components/gallery";
import { loadFanArtImages, type FanArtImage } from "@/app/lib/fanart";

interface RightSidebarProps {
  className?: string;
  images?: FanArtImage[];
}

const COMMUNITY_LINKS = [
  {
    label: "치지직 채널",
    href: "https://chzzk.naver.com/1d333ff175b4db5bd06f87a88579ec1e",
    description: "실시간 방송과 지난 라이브",
    isExternal: true,
  },
  {
    label: "유튜브",
    href: "https://www.youtube.com/channel/UCHzre37UF4o64HRhp-7CDzQ",
    description: "공식 하이라이트와 Shorts",
    isExternal: true,
  },
  {
    label: "다시보기",
    href: "https://www.youtube.com/@fullmoing",
    description: "방송 전체 아카이브",
    isExternal: true,
  },
  {
    label: "팬카페",
    href: "https://cafe.naver.com/moinge",
    description: "팬아트와 공지 확인",
    isExternal: true,
  },
];

export default function RightSidebar({ className, images }: RightSidebarProps = {}): ReactElement {
  const defaultGallery = loadFanArtImages();
  const gallery = images && images.length > 0 ? images : defaultGallery;

  return (
    <aside
      className={["flex w-full flex-col gap-4 lg:max-w-[220px] xl:max-w-[232px]", className]
        .filter(Boolean)
        .join(" ")}
    >
      <SectionCard
        tone="neutral"
        className="shadow-none"
        bodyClassName="gap-2"
        eyebrow="Off-site"
        title="외부 채널"
        description="공식 채널과 커뮤니티를 분리된 레일에서 관리합니다."
      >
        {COMMUNITY_LINKS.map((link) => {
          const content = (
            <>
              <span className="block text-sm font-semibold text-purple-950/95">{link.label}</span>
              <span className="mt-1 block text-[11px] text-purple-700/75">{link.description}</span>
            </>
          );

          if (link.isExternal) {
            return (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-2xl border border-purple-200/60 bg-white/76 px-3 py-3 transition-all duration-200 hover:bg-purple-50/80 hover:-translate-y-0.5"
                data-analytics-menu="true"
                data-analytics-id={link.href}
                data-analytics-label={link.label}
                data-analytics-location="right_sidebar"
                data-analytics-type="community_link"
              >
                {content}
              </a>
            );
          }

          return null;
        })}
      </SectionCard>

      <SectionCard
        tone="lavender"
        className="shadow-none"
        bodyClassName="gap-4"
        eyebrow="Fan Art"
        title="작업실"
        description="시선을 끊지 않도록 보조 정보로 배치했습니다."
      >
        <FanArtGallery images={gallery} />
      </SectionCard>
    </aside>
  );
}
