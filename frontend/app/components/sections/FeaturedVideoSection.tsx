"use client";

import { useMemo, useState, type ReactNode } from "react";
import { SectionCard } from "@/app/components/cards";
import VideoCard from "@/app/components/cards/VideoCard";
import { useTopOfficialVideos } from "@/app/hooks/useTopOfficialVideos";
import { useYouTubeVideos } from "@/app/hooks/useYouTubeVideos";

type VideoItem = {
  videoId: string;
  title: string;
  publishedAt: string;
  thumbnail: string;
  channelTitle: string;
  url: string;
};

type TopVideo = VideoItem & { viewCount: number | null };
type ChannelKey = "moing" | "fullmoing";

const TABS: { key: ChannelKey; label: string; hint: string }[] = [
  { key: "moing", label: "공식 채널", hint: "최신 하이라이트" },
  { key: "fullmoing", label: "다시보기", hint: "방송 아카이브" },
];

function selectLatestVideo(videos: VideoItem[]): VideoItem | null {
  if (!videos.length) return null;

  return videos.reduce<VideoItem | null>((latest, candidate) => {
    if (!latest) return candidate;
    const latestTime = Date.parse(latest.publishedAt);
    const candidateTime = Date.parse(candidate.publishedAt);
    if (Number.isNaN(candidateTime)) return latest;
    if (Number.isNaN(latestTime) || candidateTime > latestTime) return candidate;
    return latest;
  }, null);
}

function usePreviousMonthLabel(): string {
  return useMemo(() => {
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return new Intl.DateTimeFormat("ko-KR", { month: "long" }).format(prev);
  }, []);
}

export default function FeaturedVideoSection() {
  const [activeTab, setActiveTab] = useState<ChannelKey>("moing");
  const monthLabel = usePreviousMonthLabel();

  const {
    data: latestData,
    status: latestState,
    error: latestError,
  } = useYouTubeVideos();
  const {
    data: topData,
    status: topState,
    error: topError,
  } = useTopOfficialVideos();

  const latestVideos: Record<ChannelKey, VideoItem | null> = {
    moing: selectLatestVideo(latestData?.moing ?? []),
    fullmoing: selectLatestVideo(latestData?.fullmoing ?? []),
  };
  const topVideos: Record<ChannelKey, TopVideo | null> = {
    moing: topData?.moing ?? null,
    fullmoing: topData?.fullmoing ?? null,
  };

  const recentList = (latestData?.[activeTab] ?? []).slice(0, 3);
  const tabMeta = TABS.find((tab) => tab.key === activeTab) ?? TABS[0];
  const latestVideo = latestVideos[activeTab];
  const topVideo = topVideos[activeTab];
  const isLoading =
    latestState === "loading" ||
    latestState === "idle" ||
    topState === "loading" ||
    topState === "idle";
  const isError = latestState === "error" && topState === "error";
  const error = latestError ?? topError;

  return (
    <SectionCard
      tone="neutral"
      eyebrow="추천 영상"
      title="이번 주 추천 영상"
      description="최신 업로드와 지난달 조회수 1위 영상을 모았습니다."
      bodyClassName="gap-4"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-purple-950">{tabMeta.label}</p>
          <p className="text-xs text-purple-800/70">{tabMeta.hint}</p>
        </div>
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
      </div>

      {isLoading && <LoadingState />}

      {isError && (
        <p className="rounded-2xl border border-red-200/60 bg-red-50/90 p-4 text-sm text-red-600 typography-body">
          {error ?? "유튜브 영상을 불러오지 못했습니다."}
        </p>
      )}

      {!isLoading && !isError && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.18fr)_minmax(280px,0.82fr)]">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-purple-200/60 pb-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-purple-700/70">
                  최신 업로드
                </p>
                <p className="mt-1 text-sm font-semibold text-purple-950">
                  {latestVideo ? latestVideo.title : "최신 영상을 확인하는 중입니다."}
                </p>
              </div>
              {latestVideo && (
                <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700">
                  {formatDateLabel(latestVideo.publishedAt)}
                </span>
              )}
            </div>

            {latestVideo ? (
              <VideoCard video={latestVideo} />
            ) : (
              <EmptyCard message="최신 영상이 없습니다." />
            )}
          </div>

          <div className="grid content-start gap-2.5">
            <InfoPanel
              eyebrow={`${monthLabel} 인기`}
              title={topVideo ? `${monthLabel} 인기 영상` : `${monthLabel} 인기 영상 집계 중`}
              content={
                topVideo ? (
                  <a
                    href={topVideo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-[18px] border border-purple-200/55 bg-white/72 px-3.5 py-3 transition-all duration-200 hover:bg-purple-50/76"
                  >
                    <p className="text-sm font-semibold text-purple-950 line-clamp-2">{topVideo.title}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-purple-700/75">
                      <span>{topVideo.channelTitle}</span>
                      {typeof topVideo.viewCount === "number" && (
                        <>
                          <span className="h-1 w-1 rounded-full bg-purple-400" />
                          <span>{topVideo.viewCount.toLocaleString("ko-KR")}회</span>
                        </>
                      )}
                    </div>
                  </a>
                ) : (
                  <p className="text-sm text-purple-800/75">{monthLabel} 인기 영상이 없습니다.</p>
                )
              }
            />

            <InfoPanel
              eyebrow="최근 업로드"
              title="최근 업로드 목록"
              content={
                recentList.length ? (
                  <ul className="space-y-2">
                    {recentList.map((video, index) => (
                      <li key={video.videoId}>
                        <a
                          href={video.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex gap-3 rounded-[18px] border border-purple-200/50 bg-white/70 px-3 py-2.5 transition-all duration-200 hover:bg-purple-50/78"
                        >
                          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-100 text-[11px] font-bold text-purple-700">
                            {index + 1}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold text-purple-950 line-clamp-2">
                              {video.title}
                            </span>
                            <span className="mt-1 block text-[11px] text-purple-700/75">
                              {formatDateLabel(video.publishedAt)}
                            </span>
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-purple-800/75">표시할 최근 목록이 없습니다.</p>
                )
              }
            />
          </div>
        </div>
      )}
    </SectionCard>
  );
}

function InfoPanel({
  eyebrow,
  title,
  content,
}: {
  eyebrow: string;
  title: string;
  content: ReactNode;
}) {
  return (
    <div className="rounded-[20px] border border-purple-200/55 bg-white/70 p-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-purple-700/70">
        {eyebrow}
      </p>
      <p className="mt-1 text-sm font-semibold text-purple-950">{title}</p>
      <div className="mt-3">{content}</div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.18fr)_minmax(280px,0.82fr)]">
      <div className="space-y-3">
        <div className="h-14 rounded-2xl bg-purple-100/70 animate-pulse" />
        <div className="h-64 rounded-3xl bg-purple-100/70 animate-pulse" />
      </div>
      <div className="space-y-3">
        <div className="h-32 rounded-3xl bg-purple-100/70 animate-pulse" />
        <div className="h-48 rounded-3xl bg-purple-100/70 animate-pulse" />
      </div>
    </div>
  );
}

function EmptyCard({ message }: { message: string }) {
  return (
    <p className="flex h-full min-h-64 items-center justify-center rounded-3xl border border-purple-200/60 bg-white/85 p-4 text-sm text-purple-900/80 typography-body">
      {message}
    </p>
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
