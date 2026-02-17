"use client";

import { useEffect, useMemo, useState } from "react";
import { SectionCard } from "@/app/components/cards";
import VideoCard from "@/app/components/cards/VideoCard";

type VideoItem = {
  videoId: string;
  title: string;
  publishedAt: string;
  thumbnail: string;
  channelTitle: string;
  url: string;
};

type TopVideo = VideoItem & { viewCount: number | null };

type LatestApiResponse = {
  moing: VideoItem[];
  fullmoing: VideoItem[];
};

type TopApiResponse = {
  moing: TopVideo | null;
  fullmoing: TopVideo | null;
};

type LoadState = "idle" | "loading" | "ready" | "error";

type ChannelKey = "moing" | "fullmoing";

const TABS: { key: ChannelKey; label: string }[] = [
  { key: "moing", label: "공식 채널" },
  { key: "fullmoing", label: "다시보기" },
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
  const [latestState, setLatestState] = useState<LoadState>("idle");
  const [topState, setTopState] = useState<LoadState>("idle");
  const [latestVideos, setLatestVideos] = useState<Record<ChannelKey, VideoItem | null>>({
    moing: null,
    fullmoing: null,
  });
  const [topVideos, setTopVideos] = useState<Record<ChannelKey, TopVideo | null>>({
    moing: null,
    fullmoing: null,
  });
  const [error, setError] = useState<string | null>(null);
  const monthLabel = usePreviousMonthLabel();

  useEffect(() => {
    let cancelled = false;

    async function loadLatest() {
      setLatestState("loading");
      try {
        const res = await fetch("/api/youTubePlayer", { headers: { accept: "application/json" } });
        if (!res.ok) throw new Error(`영상 정보를 불러오지 못했습니다. (${res.status})`);
        const data = (await res.json()) as LatestApiResponse;
        if (cancelled) return;
        setLatestVideos({
          moing: selectLatestVideo(data.moing ?? []),
          fullmoing: selectLatestVideo(data.fullmoing ?? []),
        });
        setLatestState("ready");
      } catch (err) {
        if (!cancelled) {
          setLatestState("error");
          setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
        }
      }
    }

    async function loadTop() {
      setTopState("loading");
      try {
        const res = await fetch("/api/youTubePlayer/topOfficial", { headers: { accept: "application/json" } });
        if (!res.ok) throw new Error(`인기 영상 정보를 불러오지 못했습니다. (${res.status})`);
        const data = (await res.json()) as TopApiResponse;
        if (cancelled) return;
        setTopVideos({ moing: data.moing ?? null, fullmoing: data.fullmoing ?? null });
        setTopState("ready");
      } catch (err) {
        if (!cancelled) {
          setTopState("error");
          setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
        }
      }
    }

    loadLatest();
    loadTop();

    return () => {
      cancelled = true;
    };
  }, []);

  const isLoading = latestState === "loading" || latestState === "idle" || topState === "loading" || topState === "idle";
  const isError = latestState === "error" && topState === "error";
  const latestVideo = latestVideos[activeTab];
  const topVideo = topVideos[activeTab];

  return (
    <SectionCard
      tone="neutral"
      eyebrow="주요 영상"
      title="이번 주 추천 영상"
      bodyClassName="gap-5"
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

      {/* Loading */}
      {isLoading && <LoadingState />}

      {/* Error */}
      {isError && (
        <p className="p-4 text-sm text-red-600 border rounded-2xl border-red-200/60 bg-red-50/90 typography-body">
          {error ?? "유튜브 영상을 불러오지 못했습니다."}
        </p>
      )}

      {/* Content: asymmetric 2-column */}
      {!isLoading && !isError && (
        <div className="grid gap-5 grid-cols-1 sm:grid-cols-[1.4fr_1fr]">
          {/* Latest (large) */}
          <div className="relative stagger-item">
            {latestVideo ? (
              <div className="relative">
                <span className="absolute top-2 left-2 z-10 rounded-full bg-emerald-500/90 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
                  최신
                </span>
                <VideoCard video={latestVideo} />
              </div>
            ) : (
              <EmptyCard message="최신 영상이 없습니다." />
            )}
          </div>

          {/* Top (smaller) */}
          <div className="relative stagger-item">
            {topVideo ? (
              <div className="relative">
                <span className="absolute top-2 left-2 z-10 rounded-full bg-amber-500/90 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
                  인기
                </span>
                <VideoCard video={topVideo} />
              </div>
            ) : (
              <EmptyCard message={`${monthLabel} 인기 영상이 없습니다.`} />
            )}
          </div>
        </div>
      )}
    </SectionCard>
  );
}

function LoadingState() {
  return (
    <div className="grid gap-5 grid-cols-1 sm:grid-cols-[1.4fr_1fr]">
      <div className="space-y-3">
        <div className="w-full h-48 animate-pulse rounded-2xl bg-purple-200/50" />
        <div className="space-y-2">
          <div className="w-3/4 h-4 rounded-full animate-pulse bg-purple-200/70" />
          <div className="w-1/2 h-3 rounded-full animate-pulse bg-purple-200/60" />
        </div>
      </div>
      <div className="space-y-3">
        <div className="w-full h-48 animate-pulse rounded-2xl bg-purple-200/50" />
        <div className="space-y-2">
          <div className="w-3/4 h-4 rounded-full animate-pulse bg-purple-200/70" />
          <div className="w-1/2 h-3 rounded-full animate-pulse bg-purple-200/60" />
        </div>
      </div>
    </div>
  );
}

function EmptyCard({ message }: { message: string }) {
  return (
    <p className="flex h-full items-center justify-center p-4 text-sm border rounded-2xl border-purple-200/60 bg-white/85 text-purple-900/80 typography-body">
      {message}
    </p>
  );
}
