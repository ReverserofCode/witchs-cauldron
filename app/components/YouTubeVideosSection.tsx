"use client";

import SectionCard from "./sectionCard";
import YouTubeCategorySection from "./YouTubeCategorySection";
import { useYouTubeVideos } from "../hooks/useYouTubeVideos";

const CATEGORY_CONFIG = [
  {
    key: "moing" as const,
    title: "모잉 공식 채널 최신 영상",
    description: "공식 채널(@moing)의 최신 업로드",
  },
  {
    key: "fullmoing" as const,
    title: "모잉 다시보기 (Full) 최신 영상",
    description: "1시간 이상 길이의 다시보기(@fullmoing)",
  },
  {
    key: "moingFan" as const,
    title: "모잉 팬 채널 최신 영상",
    description: "팬 채널(@모잉수제문어포션)의 하이라이트",
  },
] as const;

export default function YouTubeVideosSection() {
  const { data, error, status } = useYouTubeVideos();
  const isLoading = status === "idle" || status === "loading";
  const isError = status === "error";
  const isReady = status === "ready" && !!data;

  return (
    <SectionCard
      tone="neutral"
      eyebrow="YouTube Hub"
      title="유튜브 영상 모음"
      description="모잉 공식·다시보기·팬 채널의 최신 영상을 한눈에 확인해 보세요."
      bodyClassName="space-y-6"
    >
      {isLoading && <div className="text-sm text-purple-900/70 typography-body">불러오는 중...</div>}
      {isError && (
        <div className="p-3 text-sm text-red-600 border border-red-200 rounded-xl bg-red-50/80 typography-body">
          {error ?? "유튜브 영상을 불러오지 못했습니다."}
        </div>
      )}

      {isReady && (
        <div className="space-y-8">
          {CATEGORY_CONFIG.map(({ key, title, description }) => (
            <YouTubeCategorySection
              key={key}
              title={title}
              description={description}
              videos={data[key] ?? []}
            />
          ))}
        </div>
      )}
    </SectionCard>
  );
}
