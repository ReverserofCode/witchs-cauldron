"use client";

import { SectionCard } from "@/app/components/cards";
import YouTubeCategorySection from "./YouTubeCategorySection";
import { YouTubeSectionStatus } from "@/app/components/status";
import { useYouTubeVideos } from "@/app/hooks/useYouTubeVideos";

interface YouTubeFanVideosSectionProps {
  className?: string;
}

export default function YouTubeFanVideosSection({ className }: YouTubeFanVideosSectionProps = {}) {
  const { data, error, status } = useYouTubeVideos();
  const videos = data?.moingFan ?? [];
  const isLoading = status === "idle" || status === "loading";
  const isError = status === "error";
  const isReady = status === "ready";

  return (
    <SectionCard
      className={className}
      tone="neutral"
      eyebrow="YouTube Hub"
      title="모잉 팬 채널 최신 영상"
      description="팬 채널(@모잉수제문어포션)의 하이라이트"
      bodyClassName="space-y-6"
    >
      {isLoading && <YouTubeSectionStatus tone="info">불러오는 중...</YouTubeSectionStatus>}
      {isError && (
        <YouTubeSectionStatus tone="error">
          {error ?? "유튜브 영상을 불러오지 못했습니다."}
        </YouTubeSectionStatus>
      )}

      {isReady && !videos.length && (
        <YouTubeSectionStatus tone="empty">현재 팬 채널 하이라이트 영상이 없습니다.</YouTubeSectionStatus>
      )}

      {isReady && videos.length > 0 && <YouTubeCategorySection description="모잉수제문어포션" videos={videos} />}
    </SectionCard>
  );
}
