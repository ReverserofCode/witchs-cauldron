"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import SectionCard from "@/app/components/cards/SectionCard";
import { trackEvent } from "@/app/components/analytics/track";
import { formatDuration, formatKoreanBroadcastDate } from "@/app/lib/broadcasts/normalize";
import {
  filterBroadcastSessions,
  isSessionNew,
  parseWatchedSessionIds,
  serializeWatchedSessionIds,
  type BroadcastProgressFilter,
} from "@/app/lib/broadcasts/progress";
import type { BroadcastAsset, BroadcastSession } from "@/app/lib/broadcasts/types";

export const WATCHED_BROADCASTS_STORAGE_KEY = "wc:broadcasts:watched:v1";
export const LAST_BROADCAST_VISIT_STORAGE_KEY = "wc:broadcasts:last-visited:v1";

type BroadcastHubStatus = "ready" | "missing_api_key" | "unavailable";

export interface BroadcastHubProps {
  sessions: BroadcastSession[];
  status: BroadcastHubStatus;
  partial: boolean;
  fetchedAt: string;
}

const PUBLISHED_AT_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "long",
  day: "numeric",
});

const FILTER_LABELS: Record<BroadcastProgressFilter, string> = {
  all: "전체",
  unwatched: "시청 전",
  new: "새 방송",
};

function formatPublishedAt(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? PUBLISHED_AT_FORMATTER.format(date) : "업로드일 미상";
}

function BroadcastAssetRow({
  asset,
  session,
  partNumber,
}: {
  asset: BroadcastAsset;
  session: BroadcastSession;
  partNumber: number;
}) {
  const handleClick = () => {
    trackEvent({
      type: "content_click",
      path: "/broadcasts",
      element: {
        type: "broadcast_replay",
        id: `${session.broadcastDate}:${asset.videoId}`,
        label: asset.displayTitle,
      },
      metadata: { location: "broadcast_hub" },
    });
  };

  return (
    <li>
      <a
        href={asset.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        className="group grid min-h-24 grid-cols-[7.5rem_minmax(0,1fr)] gap-3 rounded-2xl border border-purple-200/60 bg-white/80 p-2.5 transition hover:-translate-y-0.5 hover:border-purple-300 hover:bg-white hover:shadow-[0_12px_28px_rgba(91,33,182,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/70 focus-visible:ring-offset-2 sm:grid-cols-[10rem_minmax(0,1fr)_auto] sm:items-center sm:p-3"
        aria-label={`${asset.displayTitle}, YouTube에서 새 탭으로 보기`}
      >
        <span className="relative block aspect-video overflow-hidden rounded-xl bg-gradient-to-br from-purple-200 to-indigo-200">
          {asset.thumbnail ? (
            <Image
              src={asset.thumbnail}
              alt=""
              fill
              sizes="(min-width: 640px) 160px, 120px"
              className="object-cover transition duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <span className="flex h-full items-center justify-center text-xs font-semibold text-purple-800/70">
              다시보기
            </span>
          )}
          <span className="absolute bottom-1.5 left-1.5 rounded-full bg-purple-950/85 px-2 py-0.5 text-[10px] font-bold text-white">
            PART {partNumber}
          </span>
        </span>

        <span className="min-w-0 self-center">
          <span className="line-clamp-2 block text-sm font-bold leading-5 text-purple-950 sm:text-[15px]">
            {asset.displayTitle}
          </span>
          <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-purple-800/65 sm:text-xs">
            <span>{formatDuration(asset.durationSeconds)}</span>
            <span aria-hidden="true">·</span>
            <span>{formatPublishedAt(asset.publishedAt)} 업로드</span>
          </span>
        </span>

        <span className="col-span-2 inline-flex items-center justify-end gap-1 text-xs font-semibold text-purple-700 group-hover:text-purple-900 sm:col-span-1">
          YouTube에서 보기
          <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor">
            <path d="M7 5h8v8M15 5 6 14" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
          </svg>
        </span>
      </a>
    </li>
  );
}

function BroadcastSessionCard({
  session,
  isWatched,
  isNew,
  onToggleWatched,
}: {
  session: BroadcastSession;
  isWatched: boolean;
  isNew: boolean;
  onToggleWatched: (sessionId: string) => void;
}) {
  return (
    <article
      className={`rounded-[24px] border p-3.5 shadow-[0_14px_34px_rgba(76,29,149,0.08)] [content-visibility:auto] [contain-intrinsic-size:auto_620px] sm:p-5 ${
        isWatched ? "border-purple-200/50 bg-white/66" : "border-purple-200/75 bg-white/92"
      }`}
    >
      <header className="flex flex-col gap-3 border-b border-purple-200/60 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {isNew && (
              <span className="rounded-full bg-fuchsia-600 px-2.5 py-1 text-[10px] font-black tracking-[0.16em] text-white">
                NEW
              </span>
            )}
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-purple-700/65">
              {session.dateSource === "title" ? "방송일 기준" : "업로드일 기준"}
            </span>
          </div>
          <h2 className="mt-2 text-xl font-black tracking-tight text-purple-950 sm:text-2xl">
            {formatKoreanBroadcastDate(session.broadcastDate)} 방송
          </h2>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold sm:text-xs">
            <span className="rounded-full bg-purple-100 px-2.5 py-1 text-purple-800">
              {session.assets.length}개 파트
            </span>
            <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-indigo-800">
              총 {formatDuration(session.totalDurationSeconds)}
            </span>
            {session.categories.map((category) => (
              <span key={category} className="rounded-full bg-sky-100 px-2.5 py-1 text-sky-800">
                {category}
              </span>
            ))}
            {session.collaborators.length > 0 && (
              <span className="rounded-full bg-pink-100 px-2.5 py-1 text-pink-800">
                with {session.collaborators.join(" · ")}
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          aria-pressed={isWatched}
          onClick={() => onToggleWatched(session.id)}
          className={`inline-flex min-h-11 flex-shrink-0 items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/70 focus-visible:ring-offset-2 ${
            isWatched
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
              : "border-purple-200 bg-white text-purple-800 hover:border-purple-300 hover:bg-purple-50"
          }`}
        >
          <span aria-hidden="true">{isWatched ? "✓" : "○"}</span>
          {isWatched ? "시청함" : "시청 전"}
        </button>
      </header>

      <ol className="mt-3 space-y-2.5">
        {session.assets.map((asset, index) => (
          <BroadcastAssetRow
            key={asset.videoId}
            asset={asset}
            session={session}
            partNumber={index + 1}
          />
        ))}
      </ol>
    </article>
  );
}

export default function BroadcastHub({ sessions, status, partial, fetchedAt }: BroadcastHubProps) {
  const [filter, setFilter] = useState<BroadcastProgressFilter>("all");
  const [watchedSessionIds, setWatchedSessionIds] = useState<Set<string>>(() => new Set());
  const [lastVisitedAt, setLastVisitedAt] = useState<string | null>(null);
  const [progressReady, setProgressReady] = useState(false);
  const progressInitializedRef = useRef(false);

  useEffect(() => {
    if (progressInitializedRef.current) return;
    progressInitializedRef.current = true;

    try {
      setWatchedSessionIds(
        new Set(parseWatchedSessionIds(window.localStorage.getItem(WATCHED_BROADCASTS_STORAGE_KEY)))
      );
      setLastVisitedAt(window.localStorage.getItem(LAST_BROADCAST_VISIT_STORAGE_KEY));
      window.localStorage.setItem(LAST_BROADCAST_VISIT_STORAGE_KEY, new Date().toISOString());
    } catch {
      setWatchedSessionIds(new Set());
      setLastVisitedAt(null);
    } finally {
      setProgressReady(true);
    }
  }, []);

  useEffect(() => {
    if (!progressReady) return;

    try {
      window.localStorage.setItem(
        WATCHED_BROADCASTS_STORAGE_KEY,
        serializeWatchedSessionIds(watchedSessionIds)
      );
    } catch {
      // 저장소가 차단되어도 현재 화면의 상태는 유지한다.
    }
  }, [progressReady, watchedSessionIds]);

  const newSessionCount = useMemo(
    () =>
      progressReady
        ? sessions.filter((session) => isSessionNew(session.latestPublishedAt, lastVisitedAt)).length
        : 0,
    [lastVisitedAt, progressReady, sessions]
  );
  const unwatchedSessionCount = progressReady
    ? sessions.filter((session) => !watchedSessionIds.has(session.id)).length
    : 0;
  const visibleSessions = useMemo(
    () => filterBroadcastSessions(sessions, filter, watchedSessionIds, lastVisitedAt),
    [filter, lastVisitedAt, sessions, watchedSessionIds]
  );
  const totalAssets = sessions.reduce((total, session) => total + session.assets.length, 0);

  const toggleWatched = (sessionId: string) => {
    setWatchedSessionIds((current) => {
      const next = new Set(current);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  };

  return (
    <div className="py-5 sm:py-8 lg:py-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-3 sm:gap-5 sm:px-6 lg:px-8">
        <SectionCard
          tone="dimmed"
          header={
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-purple-200/75">
                  Broadcast Archive
                </p>
                <h1 className="mt-1.5 text-2xl font-black tracking-tight text-white sm:text-3xl">
                  놓친 방송, 날짜별로 이어보기
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-purple-100/85">
                  분할 업로드된 모잉 다시보기를 한 번의 방송으로 묶었습니다. 최근 12주 방송을 훑고 본 방송은 직접 표시해 두세요.
                </p>
              </div>
              <a
                href="https://www.youtube.com/@fullmoing"
                target="_blank"
                rel="noopener noreferrer"
                className="liquid-glass-control inline-flex min-h-10 flex-shrink-0 items-center rounded-xl px-4 py-2 text-sm font-bold text-white transition hover:-translate-y-0.5"
              >
                다시보기 원본 채널 ↗<span className="sr-only"> (새 탭에서 열림)</span>
              </a>
            </div>
          }
        >
          <div className="grid gap-2.5 sm:grid-cols-3">
            <div className="liquid-glass-panel rounded-2xl px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-purple-200/75">방송</p>
              <p className="mt-1 text-2xl font-black text-white">{sessions.length}</p>
            </div>
            <div className="liquid-glass-panel rounded-2xl px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-purple-200/75">다시보기 파트</p>
              <p className="mt-1 text-2xl font-black text-white">{totalAssets}</p>
            </div>
            <div className="liquid-glass-panel rounded-2xl px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-purple-200/75">시청 전</p>
              <p className="mt-1 text-2xl font-black text-white">
                {progressReady ? unwatchedSessionCount : "—"}
              </p>
            </div>
          </div>
        </SectionCard>

        {partial && sessions.length > 0 && (
          <div role="status" className="rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-900">
            YouTube에서 일부 정보만 불러왔습니다. 현재 확인 가능한 방송부터 보여드려요.
          </div>
        )}

        {(status !== "ready" || partial) && sessions.length === 0 ? (
          <SectionCard tone="lavender" eyebrow="Archive status" title="다시보기 목록을 준비 중이에요">
            <p className="text-sm leading-6 text-purple-900/75">
              원본 채널은 정상적으로 이용할 수 있습니다. 잠시 뒤 다시 시도하거나 아래 링크에서 최신 다시보기를 확인해 주세요.
            </p>
            <a
              href="https://www.youtube.com/@fullmoing/videos"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 w-fit items-center rounded-xl bg-purple-700 px-4 py-2 text-sm font-bold text-white hover:bg-purple-800"
            >
              다시보기 채널 열기 ↗<span className="sr-only"> (새 탭에서 열림)</span>
            </a>
          </SectionCard>
        ) : (
          <>
            <SectionCard tone="neutral" className="p-3 sm:p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-purple-950">무엇부터 볼까요?</p>
                  <p className="mt-0.5 text-xs text-purple-900/65">
                    {progressReady && lastVisitedAt
                      ? `지난 방문 이후 새 방송 ${newSessionCount}개`
                      : "시청 상태는 이 브라우저에만 저장됩니다."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2" role="group" aria-label="방송 목록 필터">
                  {(Object.keys(FILTER_LABELS) as BroadcastProgressFilter[]).map((filterValue) => {
                    const count =
                      filterValue === "all"
                        ? sessions.length
                        : filterValue === "unwatched"
                          ? unwatchedSessionCount
                          : newSessionCount;
                    return (
                      <button
                        key={filterValue}
                        type="button"
                        aria-pressed={filter === filterValue}
                        onClick={() => setFilter(filterValue)}
                        className={`min-h-10 rounded-full border px-3.5 py-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/70 focus-visible:ring-offset-2 ${
                          filter === filterValue
                            ? "border-purple-700 bg-purple-700 text-white"
                            : "border-purple-200 bg-white text-purple-800 hover:border-purple-300 hover:bg-purple-50"
                        }`}
                      >
                        {FILTER_LABELS[filterValue]} {progressReady || filterValue === "all" ? count : "—"}
                      </button>
                    );
                  })}
                </div>
              </div>
            </SectionCard>

            {visibleSessions.length > 0 ? (
              <div className="space-y-4 sm:space-y-5">
                {visibleSessions.map((session) => (
                  <BroadcastSessionCard
                    key={session.id}
                    session={session}
                    isWatched={watchedSessionIds.has(session.id)}
                    isNew={progressReady && isSessionNew(session.latestPublishedAt, lastVisitedAt)}
                    onToggleWatched={toggleWatched}
                  />
                ))}
              </div>
            ) : (
              <SectionCard tone="lavender" eyebrow="Filter result" title="조건에 맞는 방송이 없어요">
                <p className="text-sm text-purple-900/70">
                  다른 필터를 선택하거나, 새 다시보기가 올라온 뒤 다시 확인해 주세요.
                </p>
              </SectionCard>
            )}
          </>
        )}

        <p className="px-1 text-center text-[11px] text-purple-900/55">
          YouTube 공개 업로드 기준 · 최근 12주 · 목록 확인 {formatPublishedAt(fetchedAt)}
        </p>
      </div>
    </div>
  );
}
