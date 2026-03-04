"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactElement } from "react";
import { SectionCard } from "@/app/components/cards";
import { YouTubeSectionStatus } from "@/app/components/status";
import { useYouTubeVideos } from "@/app/hooks/useYouTubeVideos";
import { useActiveSection } from "@/app/hooks/useActiveSection";
import type { ScheduleEvent, ScheduleFeed } from "@/app/api/broadCastSchedule/schedule";

type FetchStatus = "idle" | "loading" | "ready" | "error";

const SCHEDULE_ENDPOINT = "/api/broadCastSchedule";
const TOP_VIDEO_ENDPOINT = "/api/youTubePlayer/topOfficial";
const CHANNEL_STATS_ENDPOINT = "/api/channelStats";
const MAX_VISIBLE_EVENTS = 3;

const TABLE_OF_CONTENTS = [
  { id: "featured-videos", label: "주요 영상" },
  { id: "clips-section", label: "숏폼 하이라이트" },
  { id: "schedule-section", label: "방송 일정" },
  { id: "youtube-hub", label: "YouTube 채널" },
];

const TOC_SECTION_IDS = TABLE_OF_CONTENTS.map((item) => item.id);

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

interface ChannelStatsData {
  youtube: {
    moing: { subscriberCount: string; channelTitle: string } | null;
    fullmoing: { subscriberCount: string; channelTitle: string } | null;
  };
  chzzk: {
    followerCount: number | null;
  };
}

const defaultImages: FanArtImage[] = [];

export default function LeftSidebar({ className, images }: LeftSidebarProps = {}): ReactElement {
  const [scheduleStatus, setScheduleStatus] = useState<FetchStatus>("idle");
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const [topVideoStatus, setTopVideoStatus] = useState<FetchStatus>("idle");
  const [topVideo, setTopVideo] = useState<TopVideoPayload | null>(null);
  const [topVideoError, setTopVideoError] = useState<string | null>(null);

  const [statsStatus, setStatsStatus] = useState<FetchStatus>("idle");
  const [channelStats, setChannelStats] = useState<ChannelStatsData | null>(null);

  const [countdown, setCountdown] = useState<string | null>(null);

  const { data: youtubeData, status: youtubeStatus, error: youtubeError } = useYouTubeVideos();
  const activeSection = useActiveSection(TOC_SECTION_IDS);

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

        const payload = (await res.json()) as {
          moing: TopVideoPayload | null;
          fullmoing: TopVideoPayload | null;
        };
        if (cancelled) return;

        // 두 채널 중 조회수가 더 높은 영상을 선택
        const candidates = [payload.moing, payload.fullmoing].filter(
          (v): v is TopVideoPayload => v !== null
        );
        const best = candidates.reduce<TopVideoPayload | null>((acc, cur) => {
          if (!acc) return cur;
          const accCount = typeof acc.viewCount === "number" ? acc.viewCount : -1;
          const curCount = typeof cur.viewCount === "number" ? cur.viewCount : -1;
          return curCount > accCount ? cur : acc;
        }, null);
        setTopVideo(best);
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

  // 채널 통계 fetch
  useEffect(() => {
    let cancelled = false;

    async function loadStats() {
      setStatsStatus("loading");
      try {
        const res = await fetch(CHANNEL_STATS_ENDPOINT, {
          headers: { accept: "application/json" },
          cache: "no-store",
        });
        if (!res.ok) throw new Error("통계 로드 실패");
        const data = (await res.json()) as ChannelStatsData;
        if (cancelled) return;
        setChannelStats(data);
        setStatsStatus("ready");
      } catch {
        if (cancelled) return;
        setStatsStatus("error");
      }
    }

    loadStats();
    return () => { cancelled = true; };
  }, []);

  const upcomingEvents = useMemo(() => selectUpcomingEvents(events, MAX_VISIBLE_EVENTS), [events]);
  const nextEvent = upcomingEvents[0] ?? null;
  const nextEventLabel = nextEvent ? formatEventDateTime(nextEvent) : undefined;

  // 카운트다운 타이머
  useEffect(() => {
    if (!nextEvent) return;

    const eventStart = new Date(nextEvent.start).getTime();
    if (Number.isNaN(eventStart)) return;

    const update = () => {
      const remaining = eventStart - Date.now();
      if (remaining <= 0) {
        setCountdown(null);
        return;
      }
      setCountdown(formatCountdown(remaining));
    };

    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [nextEvent]);

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
      {/* 1. 목차 (TOC) */}
      <SectionCard
        tone="neutral"
        className="shadow-md rounded-2xl border-white/40 bg-white/80 shadow-purple-900/10"
        bodyClassName="gap-1"
        eyebrow="Contents"
        title="목차"
      >
        <nav aria-label="페이지 목차">
          <ul className="flex flex-col gap-0.5">
            {TABLE_OF_CONTENTS.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    data-analytics-menu="true"
                    data-analytics-id={`#${item.id}`}
                    data-analytics-label={item.label}
                    data-analytics-location="left_sidebar_toc"
                    data-analytics-type="toc_link"
                    className={`block rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                      isActive
                        ? "bg-purple-200/80 text-purple-900 font-semibold shadow-sm"
                        : "text-purple-800/70 hover:bg-purple-100/60 hover:text-purple-900"
                    }`}
                  >
                    {item.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      </SectionCard>

      {/* 2. 가까운 방송 + 카운트다운 */}
      <SectionCard
        tone="neutral"
        className="shadow-md rounded-2xl border-white/40 bg-white/80 shadow-purple-900/10"
        bodyClassName="gap-3"
        eyebrow="Schedule"
        title="가까운 방송"
        description={nextEventLabel}
      >
        {scheduleStatus === "loading" && <ScheduleAsideSkeleton />}
        {scheduleStatus === "error" && scheduleError && (
          <YouTubeSectionStatus tone="error">{scheduleError}</YouTubeSectionStatus>
        )}
        {scheduleStatus === "ready" && nextEvent && (
          <div className="flex flex-col gap-2 rounded-xl border border-purple-200/60 bg-purple-100/40 px-3 py-2 text-xs text-purple-950/90">
            <span className="text-xs font-semibold text-purple-900/95 line-clamp-2">{nextEvent.title}</span>
            <div className="flex flex-wrap items-center gap-2 text-xs text-purple-700/80">
              <span>{formatEventDateTime(nextEvent)}</span>
              {nextEvent.platform && (
                <span className="inline-flex items-center gap-1 rounded-full bg-purple-200/80 px-2 py-0.5 font-semibold uppercase tracking-wide">
                  {nextEvent.platform}
                </span>
              )}
            </div>
            {countdown && (
              <span className="mt-1 inline-flex items-center justify-center rounded-lg bg-purple-200/60 px-3 py-1.5 font-mono text-sm font-semibold text-purple-900">
                {countdown}
              </span>
            )}
          </div>
        )}
        {scheduleStatus === "ready" && upcomingEvents.length > 1 && (
          <ul className="space-y-1 text-xs text-purple-800/80">
            {upcomingEvents.slice(1).map((event) => (
              <li key={event.id} className="flex flex-col gap-0.5 rounded-lg px-2 py-1 bg-white/70 transition-all duration-200 hover:bg-purple-50/80 hover:shadow-sm">
                <span className="font-semibold text-purple-900/85 line-clamp-1">{event.title}</span>
                <span>{formatEventDateTime(event)}</span>
              </li>
            ))}
          </ul>
        )}
        <Link
          href="#schedule-section"
          className="btn btn-primary mt-2 w-full justify-center text-xs"
          data-analytics-menu="true"
          data-analytics-id="#schedule-section"
          data-analytics-label="전체 일정 보기"
          data-analytics-location="left_sidebar"
          data-analytics-type="schedule_link"
        >
          전체 일정 보기
        </Link>
      </SectionCard>

      {/* 3. 바로 보기 */}
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
        {youtubeStatus === "ready" && highlightVideos.map((entry, idx) => (
          <QuickVideoItem key={entry.video.videoId} label={entry.label} video={entry.video} highlight={idx === 0} />
        ))}
        {topVideoStatus === "loading" && (
          <YouTubeSectionStatus tone="info">지난달 인기 영상을 불러오는 중...</YouTubeSectionStatus>
        )}
        {topVideoStatus === "error" && topVideoError && (
          <YouTubeSectionStatus tone="error">{topVideoError}</YouTubeSectionStatus>
        )}
        {topVideoStatus === "ready" && topVideo && <QuickVideoItem label="지난달 1위" video={topVideo} />}
      </SectionCard>

      {/* 4. 채널 통계 */}
      <SectionCard
        tone="neutral"
        className="shadow-md rounded-2xl border-white/40 bg-white/80 shadow-purple-900/10"
        bodyClassName="gap-2"
        eyebrow="Channel Stats"
        title="채널 통계"
      >
        {statsStatus === "loading" && <ChannelStatsSkeleton />}
        {statsStatus === "error" && (
          <YouTubeSectionStatus tone="error">통계를 불러오지 못했습니다.</YouTubeSectionStatus>
        )}
        {statsStatus === "ready" && channelStats && (
          <div className="grid grid-cols-3 gap-2">
            {channelStats.youtube.moing && (
              <ChannelStatCard
                icon="youtube"
                label="공식"
                value={formatSubscriberCount(Number(channelStats.youtube.moing.subscriberCount))}
              />
            )}
            {channelStats.youtube.fullmoing && (
              <ChannelStatCard
                icon="replay"
                label="다시보기"
                value={formatSubscriberCount(Number(channelStats.youtube.fullmoing.subscriberCount))}
              />
            )}
            {channelStats.chzzk.followerCount !== null && (
              <ChannelStatCard
                icon="chzzk"
                label="치지직"
                value={formatSubscriberCount(channelStats.chzzk.followerCount)}
              />
            )}
          </div>
        )}
      </SectionCard>

      {/* 5. 팬아트 갤러리 */}
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
                {item.credit && <figcaption className="text-xs text-purple-900/70">{item.credit}</figcaption>}
                <div className="flex items-center justify-between text-xs text-purple-900/60">
                  <span>
                    {index + 1} / {gallery.length}
                  </span>
                  {item.download && (
                    <a
                      href={item.download}
                      download
                      className="btn btn-primary h-8 min-w-[5rem] justify-center text-xs"
                      data-analytics-menu="true"
                      data-analytics-id={item.download}
                      data-analytics-label="팬아트 다운로드"
                      data-analytics-location="left_sidebar_gallery"
                      data-analytics-type="download_link"
                    >
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

/* ─── 카운트다운 포맷 ─── */

function formatCountdown(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}일 ${hours}시간`;
  if (hours > 0) return `${hours}시간 ${minutes}분`;
  return `${minutes}분 ${seconds}초`;
}

/* ─── 채널 통계 카드 (아이콘 기반) ─── */

function formatSubscriberCount(count: number): string {
  if (count >= 10000) return `${(count / 10000).toFixed(1).replace(/\.0$/, "")}만`;
  if (count >= 1000) return `${(count / 1000).toFixed(1).replace(/\.0$/, "")}천`;
  return count.toLocaleString("ko-KR");
}

function ChannelStatIcon({ type }: { type: "youtube" | "replay" | "chzzk" }) {
  const cls = "w-6 h-6";
  switch (type) {
    case "youtube":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={cls} fill="none">
          <rect x="2" y="5" width="20" height="14" rx="4" fill="#FF0000" />
          <polygon points="10,9 16,12 10,15" fill="#fff" />
        </svg>
      );
    case "replay":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={cls} fill="none">
          <circle cx="12" cy="12" r="10" fill="#FF0000" />
          <polygon points="11,9 16,12 11,15" fill="#fff" />
          <circle cx="12" cy="12" r="7" stroke="#fff" strokeWidth="1.5" fill="none" />
          <rect x="11.7" y="8" width="1.6" height="5" rx="0.8" fill="#fff" transform="rotate(30 12.5 10.5)" />
        </svg>
      );
    case "chzzk":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={cls} fill="none">
          <polygon points="13,2 3,14 11,14 9,22 21,8 13,8" fill="#FFD600" stroke="#FFD600" strokeWidth="1.2" />
        </svg>
      );
  }
}

function ChannelStatCard({ icon, label, value }: { icon: "youtube" | "replay" | "chzzk"; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-purple-200/50 bg-white/70 px-1 py-2 text-center transition-all duration-200 hover:bg-purple-50/80 hover:shadow-sm">
      <ChannelStatIcon type={icon} />
      <span className="text-[10px] font-semibold text-purple-700/90 tabular-nums">{value}</span>
      <span className="text-[9px] text-purple-600/70 leading-tight">{label}</span>
    </div>
  );
}

function ChannelStatsSkeleton(): ReactElement {
  return (
    <div className="grid grid-cols-3 gap-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex flex-col items-center gap-1.5 rounded-xl bg-purple-100/30 px-1 py-2.5 animate-pulse">
          <span className="w-6 h-6 rounded-full bg-purple-200/60" />
          <span className="w-8 h-2.5 rounded-full bg-purple-200/50" />
          <span className="w-10 h-2 rounded-full bg-purple-200/40" />
        </div>
      ))}
    </div>
  );
}

/* ─── 기존 유틸리티 함수 ─── */

function selectUpcomingEvents(allEvents: ScheduleEvent[], limit: number = MAX_VISIBLE_EVENTS): ScheduleEvent[] {
  const anchor = new Date();
  const now = anchor.getTime();

  const scored = allEvents
    .map((event) => {
      const projected = projectEventRange(event, anchor);
      if (!projected) {
        return null;
      }
      const { startMs, endMs } = projected;
      const isUpcoming = startMs >= now || endMs >= now;
      return { event, startMs, endMs, isUpcoming };
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value))
    .sort((a, b) => a.startMs - b.startMs);

  const upcoming = scored.filter((item) => item.isUpcoming);
  const source = upcoming.length > 0 ? upcoming : scored;

  return source.slice(0, limit).map((item) => item.event);
}

function projectEventRange(event: ScheduleEvent, anchor: Date): { startMs: number; endMs: number } | null {
  const startDate = new Date(event.start);
  if (Number.isNaN(startDate.getTime())) {
    return null;
  }

  const projectedStart = projectDateToAnchor(startDate, anchor);
  const duration = event.end ? Date.parse(event.end) - startDate.getTime() : 0;
  const safeDuration = Number.isFinite(duration) ? Math.max(duration, 0) : 0;

  return {
    startMs: projectedStart.getTime(),
    endMs: projectedStart.getTime() + safeDuration,
  };
}

function projectDateToAnchor(date: Date, anchor: Date): Date {
  const projected = new Date(date);
  projected.setFullYear(anchor.getFullYear());
  if (projected.getTime() < anchor.getTime()) {
    projected.setFullYear(anchor.getFullYear() + 1);
  }
  return projected;
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

function buildHighlightVideos(data: ReturnType<typeof useYouTubeVideos>["data"]) {
  if (!data) {
    return [] as Array<{ label: string; video: TopVideoPayload }>;
  }

  const entries: Array<{ label: string; video: TopVideoPayload }> = [];

  if (data.moing?.[0]) {
    entries.push({ label: "공식 최신", video: mapVideo(data.moing[0]) });
  }
  if (data.fullmoing?.[0]) {
    entries.push({ label: "다시보기 최신", video: mapVideo(data.fullmoing[0]) });
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
      data-analytics-menu="true"
      data-analytics-id={video.url}
      data-analytics-label={video.title}
      data-analytics-location="left_sidebar_video_pick"
      data-analytics-type="video_link"
      className={`flex flex-col gap-1 rounded-xl border px-3 py-2 text-xs transition-all duration-200 hover:scale-[1.02] hover:shadow-md ${
        highlight
          ? "border-purple-300 bg-purple-50/80 hover:bg-purple-100/80"
          : "border-purple-200/60 bg-white/70 hover:bg-purple-100/70"
      }`}
      title={video.title}
    >
      <span className="text-xs font-semibold uppercase tracking-wide text-purple-700/80">{label}</span>
      <span className="font-semibold line-clamp-2 text-purple-950/95">{video.title}</span>
      <span className="text-xs text-purple-700/75">{video.channelTitle || "모잉 채널"}</span>
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
