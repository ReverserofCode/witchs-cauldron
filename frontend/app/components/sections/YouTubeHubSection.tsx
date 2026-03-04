"use client";

import { useState } from "react";
import { SectionCard } from "@/app/components/cards";
import YouTubeCategorySection from "./YouTubeCategorySection";
import { YouTubeSectionStatus } from "@/app/components/status";
import { useYouTubeVideos } from "@/app/hooks/useYouTubeVideos";

type TabKey = "moing" | "fullmoing" | "moingFan";

const TABS: { key: TabKey; label: string }[] = [
  { key: "moing", label: "공식" },
  { key: "fullmoing", label: "다시보기" },
  { key: "moingFan", label: "팬 채널" },
];

const EMPTY_MESSAGES: Record<TabKey, string> = {
  moing: "현재 업로드된 영상이 없습니다.",
  fullmoing: "현재 업로드된 다시보기 영상이 없습니다.",
  moingFan: "현재 팬 채널 하이라이트 영상이 없습니다.",
};

export default function YouTubeHubSection() {
  const [activeTab, setActiveTab] = useState<TabKey>("moing");
  const { data, error, status } = useYouTubeVideos();
  const videos = data?.[activeTab] ?? [];
  const isLoading = status === "idle" || status === "loading";
  const isError = status === "error";
  const isReady = status === "ready";

  return (
    <SectionCard
      tone="neutral"
      eyebrow="유튜브"
      title="YouTube 채널 영상"
      bodyClassName="space-y-6"
    >
      {/* Tab pills */}
      <div className="tab-pills">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`tab-pill ${activeTab === tab.key ? "tab-pill-active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading && <YouTubeSectionStatus tone="info">불러오는 중...</YouTubeSectionStatus>}
      {isError && (
        <YouTubeSectionStatus tone="error">
          {error ?? "유튜브 영상을 불러오지 못했습니다."}
        </YouTubeSectionStatus>
      )}

      {isReady && !videos.length && (
        <YouTubeSectionStatus tone="empty">{EMPTY_MESSAGES[activeTab]}</YouTubeSectionStatus>
      )}

      {isReady && videos.length > 0 && (
        <YouTubeCategorySection
          description={activeTab === "moingFan" ? "모잉수제문어포션" : undefined}
          videos={videos}
        />
      )}
    </SectionCard>
  );
}
