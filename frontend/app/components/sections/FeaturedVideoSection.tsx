"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
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
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [isCarouselHovered, setIsCarouselHovered] = useState(false);
  const [isCarouselLocked, setIsCarouselLocked] = useState(false);
  const latestPanelRef = useRef<HTMLDivElement | null>(null);
  const hoveredRef = useRef(false);
  const resumeTimeoutRef = useRef<number | null>(null);
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
  const carouselVideos = recentList.length ? recentList : latestVideo ? [latestVideo] : [];
  const currentCarouselVideo = carouselVideos[carouselIndex] ?? latestVideo;
  const isCarouselPaused = isCarouselHovered || isCarouselLocked;
  const isLoading =
    latestState === "loading" ||
    latestState === "idle" ||
    topState === "loading" ||
    topState === "idle";
  const isError = latestState === "error" && topState === "error";
  const error = latestError ?? topError;

  useEffect(() => {
    setCarouselIndex(0);
    setIsCarouselHovered(false);
    setIsCarouselLocked(false);
    if (resumeTimeoutRef.current !== null) {
      window.clearTimeout(resumeTimeoutRef.current);
      resumeTimeoutRef.current = null;
    }
  }, [activeTab, recentList.length]);

  useEffect(() => {
    hoveredRef.current = isCarouselHovered;
  }, [isCarouselHovered]);

  useEffect(() => {
    const panel = latestPanelRef.current;
    if (!panel) {
      return;
    }

    const handleMouseEnter = () => setIsCarouselHovered(true);
    const handleMouseLeave = () => setIsCarouselHovered(false);
    const handleFocusIn = () => setIsCarouselHovered(true);
    const handleFocusOut = (event: FocusEvent) => {
      const nextTarget = event.relatedTarget;
      if (!(nextTarget instanceof Node) || !panel.contains(nextTarget)) {
        setIsCarouselHovered(false);
      }
    };

    panel.addEventListener("mouseenter", handleMouseEnter);
    panel.addEventListener("mouseleave", handleMouseLeave);
    panel.addEventListener("focusin", handleFocusIn);
    panel.addEventListener("focusout", handleFocusOut);

    return () => {
      panel.removeEventListener("mouseenter", handleMouseEnter);
      panel.removeEventListener("mouseleave", handleMouseLeave);
      panel.removeEventListener("focusin", handleFocusIn);
      panel.removeEventListener("focusout", handleFocusOut);
    };
  }, []);

  useEffect(() => {
    if (carouselVideos.length <= 1) {
      return;
    }

    if (isCarouselPaused) {
      return;
    }

    const timer = window.setTimeout(() => {
      setCarouselIndex((prev) => (prev + 1) % carouselVideos.length);
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [carouselVideos.length, carouselIndex, isCarouselPaused]);

  useEffect(() => {
    const handleWindowBlur = () => {
      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLIFrameElement && latestPanelRef.current?.contains(activeElement)) {
        setIsCarouselLocked(true);
      }
    };

    window.addEventListener("blur", handleWindowBlur);

    return () => window.removeEventListener("blur", handleWindowBlur);
  }, []);

  useEffect(() => {
    return () => {
      if (resumeTimeoutRef.current !== null) {
        window.clearTimeout(resumeTimeoutRef.current);
      }
    };
  }, []);

  const lockCarousel = () => {
    if (resumeTimeoutRef.current !== null) {
      window.clearTimeout(resumeTimeoutRef.current);
      resumeTimeoutRef.current = null;
    }

    setIsCarouselLocked(true);
  };

  const scheduleCarouselResume = () => {
    if (resumeTimeoutRef.current !== null) {
      window.clearTimeout(resumeTimeoutRef.current);
    }

    resumeTimeoutRef.current = window.setTimeout(() => {
      setIsCarouselLocked(false);
      if (!hoveredRef.current && carouselVideos.length > 1) {
        setCarouselIndex((prev) => (prev + 1) % carouselVideos.length);
      }
      resumeTimeoutRef.current = null;
    }, 5000);
  };

  return (
    <SectionCard
      tone="neutral"
      eyebrow="추천 영상"
      title="이번 주 추천 영상"
      description="최신 업로드와 지난달 조회수 1위 영상을 모았습니다."
      bodyClassName="gap-3"
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
        <div className="grid gap-3">
          <div className="grid gap-3 xl:grid-cols-2">
            <FeaturePanel
              eyebrow="최신 업로드"
              title={currentCarouselVideo ? currentCarouselVideo.title : "최신 영상을 확인하는 중입니다."}
              meta={currentCarouselVideo ? formatDateLabel(currentCarouselVideo.publishedAt) : "업데이트 대기"}
              panelRef={latestPanelRef}
              panelDataId="latest-upload-carousel"
            >
              {currentCarouselVideo ? (
                <>
                  <VideoCard
                    video={currentCarouselVideo}
                    embed
                    onInteractionStart={lockCarousel}
                    onPlaybackStart={lockCarousel}
                    onPlaybackStop={scheduleCarouselResume}
                  />
                </>
              ) : (
                <EmptyCard message="최신 영상이 없습니다." />
              )}
            </FeaturePanel>

            <FeaturePanel
              eyebrow={`${monthLabel} 인기`}
              title={topVideo ? `${monthLabel} 인기 영상` : `${monthLabel} 인기 영상 집계 중`}
              meta={
                topVideo && typeof topVideo.viewCount === "number"
                  ? `${topVideo.viewCount.toLocaleString("ko-KR")}회`
                  : "조회수 집계"
              }
            >
              {topVideo ? (
                <VideoCard video={topVideo} embed />
              ) : (
                <EmptyCard message={`${monthLabel} 인기 영상이 없습니다.`} />
              )}
            </FeaturePanel>
          </div>

          <InfoPanel
            eyebrow="최근 업로드"
            title="최근 업로드 목록"
            content={
              recentList.length ? (
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {recentList.map((video, index) => (
                    <a
                      key={video.videoId}
                      href={video.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex gap-3 rounded-[18px] border border-purple-200/50 bg-white/70 p-2.5 transition-all duration-200 hover:bg-purple-50/78"
                    >
                      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-100 text-[11px] font-bold text-purple-700">
                        {index + 1}
                      </span>
                      <span className="relative mt-0.5 h-14 w-24 shrink-0 overflow-hidden rounded-xl border border-purple-200/50 bg-purple-50/60">
                        <Image
                          src={video.thumbnail}
                          alt={video.title}
                          fill
                          unoptimized
                          sizes="96px"
                          className="object-cover"
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block line-clamp-2 text-sm font-semibold text-purple-950">
                          {video.title}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-purple-700/75">
                          <span>{video.channelTitle}</span>
                          <span className="h-1 w-1 rounded-full bg-purple-300/80" />
                          <span>{formatDateLabel(video.publishedAt)}</span>
                        </span>
                      </span>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-purple-800/75">표시할 최근 목록이 없습니다.</p>
              )
            }
          />
        </div>
      )}
    </SectionCard>
  );
}

function FeaturePanel({
  eyebrow,
  title,
  meta,
  children,
  panelRef,
  panelDataId,
}: {
  eyebrow: string;
  title: string;
  meta: string;
  children: ReactNode;
  panelRef?: RefObject<HTMLDivElement | null>;
  panelDataId?: string;
}) {
  return (
    <div
      ref={panelRef}
      data-panel-id={panelDataId}
      className="grid content-start gap-2.5 rounded-[22px] border border-purple-200/55 bg-white/68 p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-purple-200/60 pb-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-purple-700/70">
            {eyebrow}
          </p>
          <p className="mt-1 line-clamp-2 text-sm font-semibold text-purple-950">
            {title}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700">
          {meta}
        </span>
      </div>
      {children}
    </div>
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
    <div className="rounded-[20px] border border-purple-200/55 bg-white/70 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-purple-700/70">
        {eyebrow}
      </p>
      <p className="mt-1 text-sm font-semibold text-purple-950">{title}</p>
      <div className="mt-2.5">{content}</div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 xl:grid-cols-2">
        <div className="space-y-3 rounded-[22px] bg-purple-100/55 p-3">
          <div className="h-14 rounded-2xl bg-purple-100/70 animate-pulse" />
          <div className="h-64 rounded-3xl bg-purple-100/70 animate-pulse" />
        </div>
        <div className="space-y-3 rounded-[22px] bg-purple-100/55 p-3">
          <div className="h-14 rounded-2xl bg-purple-100/70 animate-pulse" />
          <div className="h-64 rounded-3xl bg-purple-100/70 animate-pulse" />
        </div>
      </div>
      <div className="h-28 rounded-[22px] bg-purple-100/55 animate-pulse" />
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
