"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactElement } from "react";
import { SectionCard } from "@/app/components/cards";
import { YouTubeSectionStatus } from "@/app/components/status";
import { useYouTubeVideos } from "@/app/hooks/useYouTubeVideos";
import type { ScheduleEvent, ScheduleFeed } from "@/app/api/broadCastSchedule/schedule";

type FetchStatus = "idle" | "loading" | "ready" | "error";

const SCHEDULE_ENDPOINT = "/api/broadCastSchedule";
const TOP_VIDEO_ENDPOINT = "/api/youTubePlayer/topOfficial";
const MAX_VISIBLE_EVENTS = 3;

const TABLE_OF_CONTENTS = [
  { id: "featured-latest", label: "최신 영상" },
  { id: "featured-top", label: "지난달 최다 조회수" },
  { id: "schedule-section", label: "방송 일정" },
  { id: "youtube-official", label: "공식 채널" },
  { id: "youtube-full", label: "다시보기" },
  { id: "youtube-fan", label: "팬 하이라이트" },
];

interface FanArtImage {
  src: string;
  alt: string;
  download?: string;
  credit?: string;
}

interface LeftSidebarProps {
  className?: string;
  images?: FanArtImage[];
}

interface TopVideoPayload {
  videoId: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
  publishedAt: string;
  url: string;
  viewCount: number | null;
}

const defaultImages: FanArtImage[] = [];

export default function LeftSidebar({ className, images }: LeftSidebarProps = {}): ReactElement {
  const [scheduleStatus, setScheduleStatus] = useState<FetchStatus>("idle");
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const [topVideoStatus, setTopVideoStatus] = useState<FetchStatus>("idle");
  const [topVideo, setTopVideo] = useState<TopVideoPayload | null>(null);
  const [topVideoError, setTopVideoError] = useState<string | null>(null);

  const { data: youtubeData, status: youtubeStatus, error: youtubeError } = useYouTubeVideos();

  useEffect(() => {
    let cancelled = false;

    async function loadSchedule() {
      setScheduleStatus("loading");
      setScheduleError(null);

      try {
        const response = await fetch(SCHEDULE_ENDPOINT, {
          headers: { accept: "application/json" },
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`일정 정보를 불러오지 못했습니다. (${response.status})`);
        }

        const payload = (await response.json()) as ScheduleFeed;
        if (cancelled) return;

        setEvents(selectUpcomingEvents(payload.events));
        setScheduleStatus("ready");
      } catch (err) {
        if (cancelled) return;
        setScheduleError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
        setScheduleStatus("error");
      }
    }

    loadSchedule();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadTopVideo() {
      setTopVideoStatus("loading");
      setTopVideoError(null);

      try {
        const res = await fetch(TOP_VIDEO_ENDPOINT, {
          headers: { accept: "application/json" },
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error(`영상 정보를 불러오지 못했습니다. (${res.status})`);
        }

        const payload = (await res.json()) as { video: TopVideoPayload | null };
        if (cancelled) return;

        setTopVideo(payload.video ?? null);
        setTopVideoStatus("ready");
      } catch (err) {
        if (cancelled) return;
        setTopVideoError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
        setTopVideoStatus("error");
      }
    }

    loadTopVideo();

    return () => {
      cancelled = true;
    };
  }, []);

  const upcomingEvents = useMemo(() => selectUpcomingEvents(events, MAX_VISIBLE_EVENTS), [events]);
  const nextEvent = upcomingEvents[0] ?? null;
  const nextEventLabel = nextEvent ? formatEventDateTime(nextEvent) : undefined;

  const latestVideo = useMemo(() => selectLatestVideo(youtubeData), [youtubeData]);
  const highlightVideos = useMemo(() => buildHighlightVideos(youtubeData), [youtubeData]);

  const gallery = useMemo(() => (images && images.length > 0 ? images : defaultImages), [images]);

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
        className="shadow-md rounded-2xl border-white/40 bg-white/80 shadow-purple-900/10"
        bodyClassName="gap-3"
        eyebrow="Today"
        title="오늘의 첫 방송"
        description={nextEventLabel}
      >
        {scheduleStatus === "loading" && <ScheduleAsideSkeleton />}
        {scheduleStatus === "error" && scheduleError && (
          <YouTubeSectionStatus tone="error">{scheduleError}</YouTubeSectionStatus>
        )}
        {scheduleStatus === "ready" && nextEvent && (
          <div className="flex flex-col gap-2 rounded-xl border border-purple-200/60 bg-purple-100/40 px-3 py-2 text-[11px] text-purple-950/90">
            <span className="text-xs font-semibold text-purple-900/95 line-clamp-2">{nextEvent.title}</span>
            <div className="flex flex-wrap items-center gap-2 text-[10px] text-purple-700/80">
              <span>{formatEventDateTime(nextEvent)}</span>
              {nextEvent.platform && (
                <span className="inline-flex items-center gap-1 rounded-full bg-purple-200/80 px-2 py-0.5 font-semibold uppercase tracking-wide">
                  {nextEvent.platform}
                </span>
              )}
            </div>
          </div>
        )}
        {scheduleStatus === "ready" && upcomingEvents.length > 1 && (
          <ul className="space-y-1 text-[10px] text-purple-800/80">
            {upcomingEvents.slice(1).map((event) => (
              <li key={event.id} className="flex flex-col gap-0.5 rounded-lg px-2 py-1 bg-white/70">
                <span className="font-semibold text-purple-900/85 line-clamp-1">{event.title}</span>
                <span>{formatEventDateTime(event)}</span>
              </li>
            ))}
          </ul>
        )}
        <Link href="#schedule-section" className="btn btn-primary mt-2 w-full justify-center text-[11px]">
          전체 일정 보기
        </Link>
      </SectionCard>

      <SectionCard
        tone="neutral"
        className="shadow-md rounded-2xl border-white/40 bg-white/85 shadow-purple-900/10"
        bodyClassName="gap-3"
        eyebrow="Video Picks"
        title="바로 보기"
      >
        {youtubeStatus === "loading" && (
          <YouTubeSectionStatus tone="info">유튜브 정보를 불러오는 중...</YouTubeSectionStatus>
        )}
        {youtubeStatus === "error" && (
          <YouTubeSectionStatus tone="error">
            {youtubeError ?? "유튜브 영상을 불러오지 못했습니다."}
          </YouTubeSectionStatus>
        )}
        {youtubeStatus === "ready" && latestVideo && <QuickVideoItem label="방금 업로드" video={latestVideo} highlight />}
        {topVideoStatus === "loading" && (
          <YouTubeSectionStatus tone="info">지난달 인기 영상을 불러오는 중...</YouTubeSectionStatus>
        )}
        {topVideoStatus === "error" && topVideoError && (
          <YouTubeSectionStatus tone="error">{topVideoError}</YouTubeSectionStatus>
        )}
        {topVideoStatus === "ready" && topVideo && <QuickVideoItem label="지난달 1위" video={topVideo} />}
        <div className="grid gap-2 text-[11px]">
          <a href="#featured-latest" className="btn btn-ghost h-8 justify-center text-[11px]">
            최신 영상 섹션으로 이동
          </a>
          <a href="#featured-top" className="btn btn-ghost h-8 justify-center text-[11px]">
            최다 조회수 섹션으로 이동
          </a>
        </div>
      </SectionCard>

      

      {gallery.length > 0 && (
        <SectionCard
          tone="lavender"
          className="shadow-md rounded-2xl border-white/40 bg-white/60 shadow-purple-900/10"
          bodyClassName="gap-4"
          eyebrow="Fan Art"
          title="마녀의 작업실"
          description="팬 아트 갤러리를 감상해 보세요."
        >
          <div className="flex flex-col gap-5">
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
        </SectionCard>
      )}
    </aside>
  );
}

function selectUpcomingEvents(allEvents: ScheduleEvent[], limit: number = MAX_VISIBLE_EVENTS): ScheduleEvent[] {
  const now = Date.now();

  const scored = allEvents
    .map((event) => {
      const start = Date.parse(event.start);
      if (Number.isNaN(start)) {
        return null;
      }
      const end = event.end ? Date.parse(event.end) : Number.NaN;
      const normalizedEnd = Number.isNaN(end) ? start : end;
      const isUpcoming = start >= now || normalizedEnd >= now;
      return { event, start, normalizedEnd, isUpcoming };
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value))
    .sort((a, b) => a.start - b.start);

  const upcoming = scored.filter((item) => item.isUpcoming);
  const source = upcoming.length > 0 ? upcoming : scored;

  return source.slice(0, limit).map((item) => item.event);
}

function formatEventDateTime(event: ScheduleEvent): string {
  const start = Date.parse(event.start);
  if (Number.isNaN(start)) {
    return "시간 미정";
  }

  const startDate = new Date(start);
  const formatter = new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  if (!event.end) {
    return formatter.format(startDate);
  }

  const end = Date.parse(event.end);
  if (Number.isNaN(end)) {
    return formatter.format(startDate);
  }

  const endDate = new Date(end);
  const endFormatter = new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${formatter.format(startDate)} · ${endFormatter.format(endDate)}`;
}

function selectLatestVideo(data: ReturnType<typeof useYouTubeVideos>["data"]): TopVideoPayload | null {
  if (!data) {
    return null;
  }

  const candidates = [
    ...(data.moing ?? []),
    ...(data.fullmoing ?? []),
    ...(data.moingFan ?? []),
  ];

  if (candidates.length === 0) {
    return null;
  }

  return candidates.reduce<TopVideoPayload | null>((latest, candidate) => {
    const candidateTime = Date.parse(candidate.publishedAt);
    if (Number.isNaN(candidateTime)) {
      return latest;
    }

    if (!latest) {
      return mapVideo(candidate);
    }

    const latestTime = Date.parse(latest.publishedAt);
    if (Number.isNaN(latestTime) || candidateTime > latestTime) {
      return mapVideo(candidate);
    }

    return latest;
  }, null);
}

function buildHighlightVideos(data: ReturnType<typeof useYouTubeVideos>["data"]) {
  if (!data) {
    return [] as Array<{ label: string; video: TopVideoPayload }>;
  }

  const entries: Array<{ label: string; video: TopVideoPayload }> = [];

  if (data.moing?.[0]) {
    entries.push({ label: "공식", video: mapVideo(data.moing[0]) });
  }
  if (data.fullmoing?.[0]) {
    entries.push({ label: "다시보기", video: mapVideo(data.fullmoing[0]) });
  }
  if (data.moingFan?.[0]) {
    entries.push({ label: "팬", video: mapVideo(data.moingFan[0]) });
  }

  return entries;
}

function mapVideo(item: {
  videoId: string;
  title: string;
  thumbnail?: string;
  channelTitle?: string;
  publishedAt: string;
  url: string;
}): TopVideoPayload {
  return {
    videoId: item.videoId,
    title: item.title,
    thumbnail: item.thumbnail ?? "",
    channelTitle: item.channelTitle ?? "",
    publishedAt: item.publishedAt,
    url: item.url,
    viewCount: null,
  };
}

function QuickVideoItem({
  label,
  video,
  highlight,
}: {
  label: string;
  video: TopVideoPayload;
  highlight?: boolean;
}) {
  return (
    <a
      href={video.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex flex-col gap-1 rounded-xl border px-3 py-2 text-[11px] transition-colors ${
        highlight
          ? "border-purple-300 bg-purple-50/80 hover:bg-purple-100/80"
          : "border-purple-200/60 bg-white/70 hover:bg-purple-100/70"
      }`}
      title={video.title}
    >
      <span className="text-[10px] font-semibold uppercase tracking-wide text-purple-700/80">{label}</span>
      <span className="font-semibold line-clamp-2 text-purple-950/95">{video.title}</span>
      <span className="text-[10px] text-purple-700/75">{video.channelTitle || "모잉 채널"}</span>
    </a>
  );
}

function ScheduleAsideSkeleton(): ReactElement {
  return (
    <ul className="space-y-2">
      {Array.from({ length: MAX_VISIBLE_EVENTS }).map((_, index) => (
        <li
          key={index}
          className="flex items-center justify-between px-3 py-2 rounded-xl bg-purple-100/30 animate-pulse"
        >
          <div className="flex flex-col w-full gap-2">
            <span className="w-full h-4 rounded-full bg-purple-200/60" />
            <span className="w-2/3 h-3 rounded-full bg-purple-200/50" />
          </div>
        </li>
      ))}
    </ul>
  );
}
