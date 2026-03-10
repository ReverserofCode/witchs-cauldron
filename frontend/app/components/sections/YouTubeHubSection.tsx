"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { SectionCard } from "@/app/components/cards";
import { YouTubeSectionStatus } from "@/app/components/status";
import { useYouTubeVideos, type VideoItem } from "@/app/hooks/useYouTubeVideos";

type TabKey = "moing" | "fullmoing" | "moingFan";

const TABS: Array<{
  key: TabKey;
  label: string;
  description: string;
  href: string;
  actionLabel: string;
}> = [
  {
    key: "moing",
    label: "공식",
    description: "모잉 공식 채널 최신 업로드",
    href: "https://www.youtube.com/channel/UCHzre37UF4o64HRhp-7CDzQ",
    actionLabel: "공식 채널 열기",
  },
  {
    key: "fullmoing",
    label: "다시보기",
    description: "풀모잉 다시보기 최신 업로드",
    href: "https://www.youtube.com/@fullmoing",
    actionLabel: "다시보기 채널 열기",
  },
  {
    key: "moingFan",
    label: "팬 채널",
    description: "모잉수제문어포션 최신 업로드",
    href: "https://www.youtube.com/@%EB%AA%A8%EC%9E%89%EC%88%98%EC%A0%9C%EB%AC%B8%EC%96%B4%ED%8F%AC%EC%85%98",
    actionLabel: "팬 채널 열기",
  },
];

const EMPTY_MESSAGES: Record<TabKey, string> = {
  moing: "현재 업로드된 공식 채널 영상이 없습니다.",
  fullmoing: "현재 업로드된 다시보기 영상이 없습니다.",
  moingFan: "현재 팬 채널 하이라이트 영상이 없습니다.",
};

export default function YouTubeHubSection() {
  const [activeTab, setActiveTab] = useState<TabKey>("moing");
  const { data, error, status } = useYouTubeVideos();
  const videos = data?.[activeTab] ?? [];
  const tabMeta = TABS.find((tab) => tab.key === activeTab) ?? TABS[0];
  const latestVideo = videos[0] ?? null;
  const browseVideos = videos.slice(0, 4);
  const isLoading = status === "idle" || status === "loading";
  const isError = status === "error";
  const isReady = status === "ready";

  const stats = useMemo(() => {
    if (!videos.length) {
      return {
        count: 0,
        latestDate: null as string | null,
        rangeLabel: null as string | null,
      };
    }

    const timestamps = videos
      .map((video) => Date.parse(video.publishedAt))
      .filter((value) => Number.isFinite(value))
      .sort((a, b) => b - a);

    const latestDate = timestamps[0] ? formatDateLabel(new Date(timestamps[0]).toISOString()) : null;
    const oldestDate = timestamps[timestamps.length - 1]
      ? formatDateLabel(new Date(timestamps[timestamps.length - 1]).toISOString())
      : null;

    return {
      count: videos.length,
      latestDate,
      rangeLabel: latestDate && oldestDate ? `${latestDate} ~ ${oldestDate}` : latestDate,
    };
  }, [videos]);

  return (
    <SectionCard
      tone="neutral"
      eyebrow="유튜브"
      title="YouTube 채널 영상"
      description="공식 채널, 다시보기, 팬 채널의 최근 업로드를 확인할 수 있습니다."
      bodyClassName="gap-4"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-purple-950">{tabMeta.label} 채널</p>
          <p className="text-xs text-purple-800/70">{tabMeta.description}</p>
        </div>
        <div className="apple-segmented">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className="apple-segmented-button"
              data-active={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <LoadingState />}
      {isError && (
        <YouTubeSectionStatus tone="error">
          {error ?? "유튜브 영상을 불러오지 못했습니다."}
        </YouTubeSectionStatus>
      )}
      {isReady && !videos.length && (
        <YouTubeSectionStatus tone="empty">{EMPTY_MESSAGES[activeTab]}</YouTubeSectionStatus>
      )}

      {isReady && videos.length > 0 && (
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center gap-2 border-b border-purple-200/60 pb-3">
            <StatPill label="불러온 수" value={`${stats.count}개`} />
            <StatPill label="최신 업로드" value={stats.latestDate ?? "확인 중"} />
            <StatPill label="표시 범위" value={stats.rangeLabel ?? "확인 중"} />
            <a
              href={tabMeta.href}
              target="_blank"
              rel="noreferrer"
              className="liquid-glass-control inline-flex min-h-10 items-center justify-center rounded-[16px] px-3.5 py-2 text-xs font-semibold text-purple-950 transition-all duration-200 hover:-translate-y-0.5 sm:ml-auto"
            >
              {tabMeta.actionLabel}
            </a>
          </div>

          <div className="grid gap-3">
            {latestVideo && (
              <a
                href={latestVideo.url}
                target="_blank"
                rel="noreferrer"
                className="apple-list-card flex gap-3 px-3.5 py-3.5 transition-all duration-200 hover:-translate-y-0.5"
              >
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-100 text-[11px] font-bold text-purple-700">
                  최신
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-purple-950 line-clamp-2">
                    {latestVideo.title}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-purple-700/75">
                    <span>{latestVideo.channelTitle}</span>
                    <span className="h-1 w-1 rounded-full bg-purple-400" />
                    <span>{formatDateLabel(latestVideo.publishedAt)}</span>
                  </div>
                </div>
              </a>
            )}

            <div className="grid gap-3">
              {browseVideos.map((video, index) => (
                <BrowseRow key={video.videoId} index={index + 1} video={video} />
              ))}
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

function BrowseRow({ index, video }: { index: number; video: VideoItem }) {
  return (
    <a
      href={video.url}
      target="_blank"
      rel="noreferrer"
      className="apple-list-card flex items-center gap-3 px-3 py-2.5 transition-all duration-200 hover:-translate-y-0.5"
    >
      <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-[14px]">
        <Image
          src={video.thumbnail || "/mainPage/SDCharacter.png"}
          alt={video.title}
          fill
          unoptimized
          sizes="112px"
          className="object-cover"
        />
      </div>
      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-purple-100 text-[11px] font-bold text-purple-700">
        {index}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-purple-950 line-clamp-2">
          {video.title}
        </span>
        <span className="mt-1 block text-[11px] text-purple-700/75">
          {video.channelTitle} · {formatDateLabel(video.publishedAt)}
        </span>
      </span>
    </a>
  );
}

function StatPill({ label, value }: { label: string; value: string | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-200/60 bg-white/72 px-3 py-1.5 text-[11px] text-purple-900/80">
      <span className="font-semibold text-purple-700/70">{label}</span>
      <span className="font-semibold text-purple-950">{value ?? "확인 중"}</span>
    </span>
  );
}

function LoadingState() {
  return (
    <div className="grid gap-4">
      <div className="h-20 rounded-[24px] bg-purple-100/70 animate-pulse" />
      <div className="h-20 rounded-[24px] bg-purple-100/70 animate-pulse" />
      <div className="grid gap-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-24 rounded-[24px] bg-purple-100/70 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

function formatDateLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "날짜 미정";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
  }).format(date);
}
