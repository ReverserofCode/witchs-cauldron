"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactElement } from "react";
import { SectionCard } from "@/app/components/cards";
import { YouTubeSectionStatus } from "@/app/components/status";
import { useActiveSection } from "@/app/hooks/useActiveSection";
import type { ScheduleEvent, ScheduleFeed } from "@/app/api/broadCastSchedule/schedule";
import { selectUpcomingScheduleEvents } from "@/app/lib/schedule";

type FetchStatus = "idle" | "loading" | "ready" | "error";

const SCHEDULE_ENDPOINT = "/api/broadCastSchedule";
const CHANNEL_STATS_ENDPOINT = "/api/channelStats";
const MAX_VISIBLE_EVENTS = 3;

const TABLE_OF_CONTENTS = [
  { id: "featured-videos", label: "주요 영상", brief: "이번 주 추천 영상" },
  { id: "schedule-section", label: "방송 일정", brief: "향후 4일 일정" },
  { id: "clips-section", label: "숏폼", brief: "클립과 Shorts" },
  { id: "youtube-hub", label: "YouTube 허브", brief: "채널별 영상 탐색" },
];

const TOC_SECTION_IDS = TABLE_OF_CONTENTS.map((item) => item.id);

const QUICK_LINKS: Array<{
  label: string;
  href: string;
  icon: "broadcast" | "community" | "calendar";
}> = [
  {
    label: "치지직",
    href: "https://chzzk.naver.com/1d333ff175b4db5bd06f87a88579ec1e",
    icon: "broadcast",
  },
  {
    label: "팬카페",
    href: "https://cafe.naver.com/moinge",
    icon: "community",
  },
  {
    label: "일정으로 이동",
    href: "#schedule-section",
    icon: "calendar",
  },
];

interface LeftSidebarProps {
  className?: string;
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

export default function LeftSidebar({ className }: LeftSidebarProps = {}): ReactElement {
  const [scheduleStatus, setScheduleStatus] = useState<FetchStatus>("idle");
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [statsStatus, setStatsStatus] = useState<FetchStatus>("idle");
  const [channelStats, setChannelStats] = useState<ChannelStatsData | null>(null);
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

        setEvents(payload.events);
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

    async function loadStats() {
      setStatsStatus("loading");

      try {
        const res = await fetch(CHANNEL_STATS_ENDPOINT, {
          headers: { accept: "application/json" },
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error("통계 로드 실패");
        }

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

    return () => {
      cancelled = true;
    };
  }, []);

  const upcomingEvents = useMemo(
    () => selectUpcomingScheduleEvents(events, MAX_VISIBLE_EVENTS),
    [events]
  );
  const nextEvent = upcomingEvents[0] ?? null;

  return (
    <aside
      className={["flex w-full flex-col gap-4 lg:max-w-[220px] xl:max-w-[232px]", className]
        .filter(Boolean)
        .join(" ")}
    >
      <SectionCard
        tone="neutral"
        className="shadow-none"
        bodyClassName="gap-3"
        eyebrow="Navigate"
        title="페이지 흐름"
        description="본 페이지의 핵심 섹션만 빠르게 훑습니다."
      >
        <nav aria-label="페이지 목차">
          <ul className="flex flex-col gap-2">
            {TABLE_OF_CONTENTS.map((item, index) => {
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
                    className={`flex items-start gap-3 rounded-2xl border px-3 py-3 transition-all duration-200 ${
                      isActive
                        ? "border-purple-300/70 bg-purple-100/80 shadow-sm"
                        : "border-purple-200/60 bg-white/72 hover:bg-purple-50/75"
                    }`}
                  >
                    <span
                      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                        isActive
                          ? "bg-purple-900 text-white"
                          : "bg-purple-100 text-purple-700"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-purple-950">
                        {item.label}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-purple-800/70">
                        {item.brief}
                      </span>
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      </SectionCard>

      <SectionCard
        tone="neutral"
        className="shadow-none"
        bodyClassName="gap-3"
        eyebrow="Now"
        title="다음 방송"
        description={nextEvent ? formatEventDateTime(nextEvent) : "예정된 방송을 찾는 중입니다."}
      >
        {scheduleStatus === "loading" && <ScheduleSkeleton />}
        {scheduleStatus === "error" && scheduleError && (
          <YouTubeSectionStatus tone="error">{scheduleError}</YouTubeSectionStatus>
        )}
        {scheduleStatus === "ready" && nextEvent && (
          <div className="rounded-2xl border border-purple-200/60 bg-purple-50/85 p-4">
            <p className="text-sm font-bold text-purple-950 line-clamp-2">{nextEvent.title}</p>
            <div className="mt-3 flex flex-col gap-1.5 text-[11px] text-purple-800/75">
              <span>{formatEventDateTime(nextEvent)}</span>
              {nextEvent.platform && (
                <span className="inline-flex w-fit items-center gap-1 rounded-full bg-white px-2 py-1 font-semibold text-purple-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-purple-500" aria-hidden />
                  {nextEvent.platform}
                </span>
              )}
            </div>
          </div>
        )}
        {scheduleStatus === "ready" && upcomingEvents.length > 1 && (
          <ul className="space-y-2">
            {upcomingEvents.slice(1).map((event) => (
              <li
                key={event.id}
                className="rounded-xl border border-purple-200/60 bg-white/72 px-3 py-2"
              >
                <p className="text-xs font-semibold text-purple-900 line-clamp-1">{event.title}</p>
                <p className="mt-1 text-[11px] text-purple-700/75">{formatEventDateTime(event)}</p>
              </li>
            ))}
          </ul>
        )}
        {scheduleStatus === "ready" && !nextEvent && (
          <p className="rounded-2xl border border-dashed border-purple-200/60 bg-white/70 px-4 py-5 text-xs text-purple-700/75">
            예정된 방송이 아직 없습니다.
          </p>
        )}
        <Link
          href="#schedule-section"
          className="inline-flex items-center justify-center rounded-xl border border-purple-200/70 bg-white/80 px-3 py-2 text-xs font-semibold text-purple-800 transition hover:bg-purple-50"
          data-analytics-menu="true"
          data-analytics-id="#schedule-section"
          data-analytics-label="전체 일정 보기"
          data-analytics-location="left_sidebar"
          data-analytics-type="schedule_link"
        >
          전체 일정 보기
        </Link>
      </SectionCard>

      <SectionCard
        tone="lavender"
        className="shadow-none"
        bodyClassName="gap-3"
        eyebrow="Signal"
        title="채널 규모"
        description="핵심 지표만 한눈에 확인합니다."
      >
        {statsStatus === "loading" && <StatsSkeleton />}
        {statsStatus === "error" && (
          <YouTubeSectionStatus tone="error">통계를 불러오지 못했습니다.</YouTubeSectionStatus>
        )}
        {statsStatus === "ready" && channelStats && (
          <div className="grid grid-cols-2 gap-2">
            {channelStats.youtube.moing && (
              <StatTile
                icon="youtube"
                label="공식"
                value={formatSubscriberCount(Number(channelStats.youtube.moing.subscriberCount))}
              />
            )}
            {channelStats.youtube.fullmoing && (
              <StatTile
                icon="replay"
                label="다시보기"
                value={formatSubscriberCount(Number(channelStats.youtube.fullmoing.subscriberCount))}
              />
            )}
            {channelStats.chzzk.followerCount !== null && (
              <StatTile
                icon="chzzk"
                label="치지직"
                value={formatSubscriberCount(channelStats.chzzk.followerCount)}
              />
            )}
          </div>
        )}
      </SectionCard>

      <SectionCard
        tone="neutral"
        className="shadow-none"
        bodyClassName="gap-2"
        eyebrow="Quick Links"
        title="바로 이동"
      >
        {QUICK_LINKS.map((link) => {
          const isExternal = link.href.startsWith("http");
          return (
            <a
              key={link.href}
              href={link.href}
              target={isExternal ? "_blank" : undefined}
              rel={isExternal ? "noreferrer" : undefined}
              className="flex items-center gap-3 rounded-2xl border border-purple-200/60 bg-white/72 px-3 py-3 text-sm font-semibold text-purple-900 transition-all duration-200 hover:bg-purple-50/80"
              data-analytics-menu="true"
              data-analytics-id={link.href}
              data-analytics-label={link.label}
              data-analytics-location="left_sidebar_quick_links"
              data-analytics-type="quick_link"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 text-purple-700">
                <QuickLinkGlyph type={link.icon} />
              </span>
              <span>{link.label}</span>
            </a>
          );
        })}
      </SectionCard>
    </aside>
  );
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

function formatSubscriberCount(count: number): string {
  if (count >= 10000) return `${(count / 10000).toFixed(1).replace(/\.0$/, "")}만`;
  if (count >= 1000) return `${(count / 1000).toFixed(1).replace(/\.0$/, "")}천`;
  return count.toLocaleString("ko-KR");
}

function StatsSkeleton(): ReactElement {
  return (
    <div className="grid grid-cols-2 gap-2">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="rounded-2xl border border-purple-200/40 bg-white/60 px-3 py-4 animate-pulse"
        >
          <div className="h-4 w-10 rounded-full bg-purple-200/60" />
          <div className="mt-3 h-5 w-16 rounded-full bg-purple-200/50" />
          <div className="mt-2 h-3 w-12 rounded-full bg-purple-200/40" />
        </div>
      ))}
    </div>
  );
}

function ScheduleSkeleton(): ReactElement {
  return (
    <div className="rounded-2xl border border-purple-200/40 bg-white/60 px-4 py-4 animate-pulse">
      <div className="h-4 w-2/3 rounded-full bg-purple-200/60" />
      <div className="mt-3 h-3 w-1/2 rounded-full bg-purple-200/50" />
      <div className="mt-2 h-3 w-1/3 rounded-full bg-purple-200/40" />
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
}: {
  icon: "youtube" | "replay" | "chzzk";
  label: string;
  value: string;
}) {
  const srcByType: Record<typeof icon, string> = {
    youtube: "/gnbIcon/YouTube.svg",
    replay: "/gnbIcon/YouTube.svg",
    chzzk: "/gnbIcon/chzzk Icon.png",
  };

  return (
    <div className="rounded-2xl border border-purple-200/60 bg-white/78 px-3 py-3">
      <div className="flex items-center gap-2">
        <span className="relative inline-block h-6 w-6 shrink-0">
          <Image src={srcByType[icon]} alt="" fill className="object-contain" sizes="24px" />
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-purple-700/75">
          {label}
        </span>
      </div>
      <p className="mt-3 text-lg font-black text-purple-950 tabular-nums">{value}</p>
    </div>
  );
}

function QuickLinkGlyph({ type }: { type: "broadcast" | "community" | "calendar" }) {
  if (type === "broadcast") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M5 12a7 7 0 0 1 14 0m-4 0a3 3 0 0 0-6 0m3 3.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (type === "community") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M7 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Zm10 0a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7ZM3.5 20a4.5 4.5 0 0 1 7 0m3 0a4.5 4.5 0 0 1 7 0"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 3v3m10-3v3M4 9h16M6 5h12a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm2 7h3m2 0h3m-8 4h8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
