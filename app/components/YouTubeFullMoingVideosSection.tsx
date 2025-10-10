"use client";

import SectionCard from "./sectionCard";
import YouTubeCategorySection from "./YouTubeCategorySection";
import { useYouTubeVideos } from "../hooks/useYouTubeVideos";

interface YouTubeFullMoingVideosSectionProps {
  className?: string;
}

export default function YouTubeFullMoingVideosSection({ className }: YouTubeFullMoingVideosSectionProps = {}) {
  const { data, error, status } = useYouTubeVideos();
  const videos = data?.fullmoing ?? [];
  const isLoading = status === "idle" || status === "loading";
  const isError = status === "error";
  const isReady = status === "ready";

  return (
    <SectionCard
      className={className}
      tone="neutral"
      eyebrow="YouTube Hub"
      title="모잉 다시보기 (Full) 최신 영상"
      description="1시간 이상 길이의 다시보기(@fullmoing)"
      bodyClassName="space-y-6"
    >
      {isLoading && <div className="text-sm text-purple-900/70 typography-body">불러오는 중...</div>}
      {isError && (
        <div className="p-3 text-sm text-red-600 border border-red-200 rounded-xl bg-red-50/80 typography-body">
          {error ?? "유튜브 영상을 불러오지 못했습니다."}
        </div>
      )}

      {isReady && !videos.length && (
        <div className="p-3 text-sm text-purple-900/75 border border-purple-200/60 rounded-xl bg-white/85 typography-body">
          현재 업로드된 다시보기 영상이 없습니다.
        </div>
      )}

      {isReady && videos.length > 0 && (
        <YouTubeCategorySection
          title="모잉 다시보기 (Full) 최신 영상"
          description="1시간 이상 길이의 다시보기(@fullmoing)"
          videos={videos}
        />
      )}
    </SectionCard>
  );
}
