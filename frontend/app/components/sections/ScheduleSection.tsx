'use client';

import { useEffect, useMemo, useState } from 'react';
import SectionCard from '../cards/SectionCard';
import { ScheduleModal } from '../modals';
import type { ScheduleDiagnostics, ScheduleEvent, ScheduleFeed } from '@/app/api/broadCastSchedule/schedule';
import { addDays, formatDateKey, normalizeScheduleEvents, selectUpcomingScheduleEvents, startOfDay } from '@/app/lib/schedule';

type ScheduleStatus = 'idle' | 'loading' | 'ready' | 'error';

interface ScheduleSectionProps {
  className?: string;
  limit?: number;
  daysToShow?: number;
  embedded?: boolean;
}

interface WeekColumn {
  isoDate: string;
  dateLabel: string;
  weekdayLabel: string;
  events: ScheduleEvent[];
  isWeekend: boolean;
}

const SCHEDULE_ENDPOINT = '/api/broadCastSchedule';
const MAX_EVENTS_PER_DAY = 4;
const DAYS_TO_SHOW = 5;
const SHOW_SCHEDULE_DIAGNOSTICS =
  process.env.NODE_ENV !== 'production' ||
  process.env.NEXT_PUBLIC_ENABLE_SCHEDULE_DIAGNOSTICS === 'true';

export default function ScheduleSection({
  className,
  limit = MAX_EVENTS_PER_DAY,
  daysToShow = DAYS_TO_SHOW,
  embedded = false,
}: ScheduleSectionProps) {
  const [status, setStatus] = useState<ScheduleStatus>('idle');
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [allEvents, setAllEvents] = useState<ScheduleEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<ScheduleDiagnostics | null>(null);
  const [diagnoseStatus, setDiagnoseStatus] = useState<'idle' | 'running' | 'ready' | 'error'>('idle');
  const [diagnoseError, setDiagnoseError] = useState<string | null>(null);
  const [weekRange, setWeekRange] = useState<{ start: string; end: string } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const clampedLimit = useMemo(() => {
    if (typeof limit !== 'number' || Number.isNaN(limit)) {
      return MAX_EVENTS_PER_DAY;
    }

    const integral = Math.trunc(limit);
    return Math.max(1, Math.min(integral, MAX_EVENTS_PER_DAY));
  }, [limit]);

  const clampedDaysToShow = useMemo(() => {
    if (typeof daysToShow !== 'number' || Number.isNaN(daysToShow)) {
      return DAYS_TO_SHOW;
    }

    const integral = Math.trunc(daysToShow);
    return Math.max(1, Math.min(integral, DAYS_TO_SHOW));
  }, [daysToShow]);

  useEffect(() => {
    let cancelled = false;

  async function loadSchedule() {
      setStatus('loading');
      setError(null);
      setDiagnostics(null);
      setDiagnoseStatus('idle');
      setDiagnoseError(null);

      try {
        const res = await fetch(SCHEDULE_ENDPOINT, {
          headers: { accept: 'application/json' },
        });

        if (!res.ok) {
          throw new Error(`요청이 실패했습니다. (${res.status})`);
        }

        const data = (await res.json()) as ScheduleFeed;
        if (!cancelled) {
          const normalizedEvents = normalizeScheduleEvents(data.events).map((item) => item.event);
          const upcomingEvents = selectUpcomingScheduleEvents(normalizedEvents, undefined, new Date());
          const { events: upcomingWeek, range } = selectEventsForWeek(upcomingEvents, clampedDaysToShow);
          setEvents(upcomingWeek);
          setAllEvents(upcomingEvents);
          setWeekRange(range);
          setStatus('ready');
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
          setStatus('error');
        }
      }
    }

    loadSchedule();

    return () => {
      cancelled = true;
    };
  }, [clampedDaysToShow]);

  const handleRunDiagnostics = async () => {
    setDiagnoseStatus('running');
    setDiagnoseError(null);

    try {
  const res = await fetch(`${SCHEDULE_ENDPOINT}?debug=1`, {
        headers: { accept: 'application/json' },
        cache: 'no-store',
      });

      if (!res.ok) {
        throw new Error(`진단 요청이 실패했습니다. (${res.status})`);
      }

      const payload = (await res.json()) as {
        diagnostics: ScheduleDiagnostics;
        feed: ScheduleFeed | null;
        hint?: string;
      };

      setDiagnostics(payload.diagnostics);

      const feedEvents = payload.feed?.events ?? [];
      const normalizedEvents = normalizeScheduleEvents(feedEvents).map((item) => item.event);
      const upcomingEvents = selectUpcomingScheduleEvents(normalizedEvents, undefined, new Date());
      const { events: upcomingWeek, range } = selectEventsForWeek(upcomingEvents, clampedDaysToShow);
      setEvents(upcomingWeek);
      setAllEvents(upcomingEvents);
      setWeekRange(range);
      setStatus('ready');

      setDiagnoseStatus('ready');
    } catch (err) {
      setDiagnoseStatus('error');
      setDiagnoseError(err instanceof Error ? err.message : '진단 실행 중 오류가 발생했습니다.');
    }
  };

  const weekColumns = useMemo<WeekColumn[]>(
    () => buildWeekColumns(events, weekRange?.start, clampedLimit, clampedDaysToShow),
    [events, weekRange?.start, clampedLimit, clampedDaysToShow]
  );

  const hasAnyEvents = useMemo(() => weekColumns.some((day) => day.events.length > 0), [weekColumns]);

  const weekRangeLabel = useMemo(() => formatWeekRangeLabel(weekRange), [weekRange]);

  const sectionContent = (
    <>
      {status === 'loading' && <ScheduleSkeleton daysToShow={clampedDaysToShow} />}
      {status === 'error' && (
        <div className="space-y-3 rounded-2xl border border-red-200 bg-red-50/80 p-4 text-xs text-red-700 typography-small">
          <div className="typography-small">
            일정 정보를 불러오지 못했습니다.
            <br />
            {error}
          </div>
          {SHOW_SCHEDULE_DIAGNOSTICS ? (
            <div className="flex flex-wrap gap-2 text-xs">
              <button
                type="button"
                onClick={handleRunDiagnostics}
                disabled={diagnoseStatus === 'running'}
                className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 font-semibold text-purple-800 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {diagnoseStatus === 'running' ? '진단 실행 중...' : '자동 진단 실행'}
              </button>
              <a
                href={`${SCHEDULE_ENDPOINT}?debug=1`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center rounded-full border border-purple-300/70 px-3 py-1 font-semibold text-purple-800 transition hover:bg-purple-100/60"
              >
                API 응답 열기
              </a>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 font-semibold text-purple-800 transition hover:bg-white"
            >
              다시 시도
            </button>
          )}
          {SHOW_SCHEDULE_DIAGNOSTICS && diagnoseStatus === 'error' && diagnoseError && (
            <p className="text-sm text-red-600">{diagnoseError}</p>
          )}
        </div>
      )}
      {status === 'ready' && (
        <div className={embedded ? 'space-y-2.5' : 'space-y-4'}>
          <div className={`flex flex-wrap items-center justify-between gap-2 text-xs text-purple-800/70 ${embedded ? 'border-t border-purple-200/55 pt-2.5' : 'border-b border-purple-200/60 pb-3'}`}>
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-purple-700/70">
                라이브 일정표
              </p>
              <div className="flex flex-wrap items-center gap-3">
                {weekRangeLabel && <span>{weekRangeLabel}</span>}
                {!hasAnyEvents && <span className="font-medium text-purple-700 typography-small">이번 주에는 예정된 방송이 없습니다.</span>}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className={`inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-purple-200 bg-white font-semibold text-purple-700 transition-colors hover:border-purple-300 hover:bg-purple-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white sm:w-auto ${embedded ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-2 text-xs'}`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              전체 일정 보기
            </button>
          </div>

          {embedded ? (
            <ul className="space-y-1.5">
              {weekColumns.map((day) => (
                <li
                  key={day.isoDate}
                  className={`stagger-item rounded-[20px] border px-3 py-3 transition ${
                    day.isWeekend ? 'border-purple-300/65 bg-purple-50/65' : 'border-purple-200/55 bg-white/76'
                  }`}
                >
                  <div className="flex gap-2">
                    <div className="flex w-12 shrink-0 flex-col items-center justify-center rounded-[12px] bg-purple-100/85 px-1.5 py-1.5 text-center">
                      <span className="text-[12px] font-bold text-purple-900">{day.dateLabel}</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-purple-700/75">
                        {day.weekdayLabel}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      {day.events.length > 0 ? (
                        day.events.map((event) => (
                          <article
                            key={event.id}
                            className="rounded-[12px] border border-purple-200/55 bg-white/82 px-2 py-1.5"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="line-clamp-2 text-[12px] font-semibold leading-[1.1rem] text-purple-950">{event.title}</p>
                              </div>
                              <span className="shrink-0 rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700">
                                {formatTimeRange(event.start, event.end)}
                              </span>
                            </div>
                          </article>
                        ))
                      ) : (
                        <p className="rounded-[12px] border border-dashed border-purple-200/60 bg-white/55 px-3 py-2 text-center text-[11px] text-purple-700/70 typography-small">
                          일정 없음
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <ul className={`grid grid-cols-1 gap-3 ${clampedDaysToShow >= 4 ? 'sm:grid-cols-2 xl:grid-cols-4' : clampedDaysToShow === 3 ? 'sm:grid-cols-3' : clampedDaysToShow === 2 ? 'sm:grid-cols-2' : ''}`}>
              {weekColumns.map((day) => (
                <li
                  key={day.isoDate}
                  className={`stagger-item flex min-h-[132px] flex-col rounded-[20px] border p-3 transition ${
                    day.isWeekend ? 'border-purple-300/65 bg-purple-50/65' : 'border-purple-200/55 bg-white/76'
                  }`}
                >
                  <header className="mb-3 flex items-baseline justify-between gap-2 border-b border-purple-200/55 pb-2">
                    <span
                      className={`text-lg font-bold ${
                        day.isWeekend ? 'text-purple-900' : 'text-purple-900/90'
                      }`}
                    >
                      {day.dateLabel}
                    </span>
                    <span
                      className={`text-xs font-semibold uppercase tracking-wide ${
                        day.isWeekend ? 'text-purple-800' : 'text-purple-700/70'
                      }`}
                    >
                      {day.weekdayLabel}
                    </span>
                  </header>

                  <div className="flex flex-1 flex-col gap-2">
                    {day.events.length > 0 ? (
                      day.events.map((event) => (
                        <article
                          key={event.id}
                          className="rounded-[16px] border-l-2 border-purple-400/70 bg-white/82 px-3 py-2 text-xs text-purple-900 transition-all duration-200"
                        >
                          <p className="line-clamp-2 font-semibold text-purple-900/95 typography-body">{event.title}</p>
                          <p className="mt-1 text-[11px] font-medium text-purple-700/80 typography-small">
                            {formatTimeRange(event.start, event.end)}
                          </p>
                          {(event.platform || event.description) && (
                            <p className="mt-1 line-clamp-1 text-[11px] text-purple-700/78 typography-small">
                              {event.platform ? `${event.platform}${event.description ? ' · ' : ''}` : ''}
                              {event.description ?? ''}
                            </p>
                          )}
                        </article>
                      ))
                    ) : (
                      <p className="flex flex-1 items-center justify-center rounded-[16px] border border-dashed border-purple-200/60 bg-white/55 px-3 py-5 text-center text-xs text-purple-700/70 typography-small">
                        일정 없음
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {SHOW_SCHEDULE_DIAGNOSTICS && diagnostics && <DiagnosticsPanel diagnostics={diagnostics} status={diagnoseStatus} />}
      <ScheduleModal
        events={allEvents}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );

  if (embedded) {
    return sectionContent;
  }

  return (
    <SectionCard
      id="schedule-section"
      className={className}
      tone="lavender"
      eyebrow="일정"
      title="라이브 일정표"
      description={`오늘부터 ${clampedDaysToShow}일 일정과 예정 방송을 확인할 수 있습니다.`}
      bodyClassName="relative gap-4"
    >
      {sectionContent}
    </SectionCard>
  );
}

function selectEventsForWeek(
  events: ScheduleEvent[],
  daysToShow: number
): { events: ScheduleEvent[]; range: { start: string; end: string } } {
  const todayAnchor = startOfDay(new Date());
  
  // 오늘부터 지정된 일수만큼의 이벤트만 필터링
  return filterEventsWithinRange(events, todayAnchor, daysToShow);
}

function filterEventsWithinRange(
  events: ScheduleEvent[],
  anchorDate: Date,
  daysToShow: number
): { events: ScheduleEvent[]; range: { start: string; end: string } } {
  const start = startOfDay(anchorDate);
  const end = addDays(start, daysToShow);
  const rangeStartMs = start.getTime();
  const rangeEndMs = end.getTime();

  const projected = events
    .map((event) => {
      const startMs = Date.parse(event.start);
      if (!Number.isFinite(startMs)) return null;
      const duration = event.end ? Date.parse(event.end) - startMs : 0;
      const safeDuration = Number.isFinite(duration) ? Math.max(duration, 0) : 0;
      return {
        event,
        startMs,
        endMs: startMs + safeDuration,
      };
    })
    .filter((value): value is { event: ScheduleEvent; startMs: number; endMs: number } => Boolean(value));

  const filtered = projected
    .filter(({ startMs, endMs }) => {
      const startsInRange = startMs >= rangeStartMs && startMs < rangeEndMs;
      const endsInRange = endMs >= rangeStartMs && endMs < rangeEndMs;
      const spansRange = startMs < rangeStartMs && endMs >= rangeStartMs;

      return startsInRange || endsInRange || spansRange;
    })
    .sort((a, b) => a.startMs - b.startMs)
    .map((item) => item.event);

  return {
    events: filtered,
    range: {
      start: start.toISOString(),
      end: end.toISOString(),
    },
  };
}

function buildWeekColumns(
  events: ScheduleEvent[],
  rangeStartIso: string | undefined,
  limitPerDay: number,
  daysToShow: number
): WeekColumn[] {
  const start = rangeStartIso ? startOfDay(new Date(rangeStartIso)) : startOfDay(new Date());
  const dateKeyedEvents = new Map<string, Array<{ event: ScheduleEvent; startMs: number }>>();

  events.forEach((event) => {
    const startMs = Date.parse(event.start);
    if (!Number.isFinite(startMs)) {
      return;
    }
    const key = formatDateKey(new Date(startMs));
    const bucket = dateKeyedEvents.get(key) ?? [];
    bucket.push({ event, startMs });
    dateKeyedEvents.set(key, bucket);
  });

  const dateFormatter = new Intl.DateTimeFormat('ko-KR', {
    month: 'numeric',
    day: 'numeric',
  });
  const weekdayFormatter = new Intl.DateTimeFormat('ko-KR', {
    weekday: 'short',
  });

  return Array.from({ length: daysToShow }).map((_, index) => {
    const currentDate = addDays(start, index);
    const key = formatDateKey(currentDate);
    const bucket = dateKeyedEvents.get(key) ?? [];
    const sorted = bucket.slice().sort((a, b) => a.startMs - b.startMs);
    const limited = sorted.slice(0, limitPerDay).map((item) => item.event);
    const isWeekend = [0, 6].includes(currentDate.getDay());

    return {
      isoDate: key,
      dateLabel: dateFormatter.format(currentDate),
      weekdayLabel: weekdayFormatter.format(currentDate),
      events: limited,
      isWeekend,
    };
  });
}

function formatWeekRangeLabel(range: { start: string; end: string } | null): string {
  if (!range) {
    return '';
  }

  try {
    const start = new Date(range.start);
    const exclusiveEnd = new Date(range.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(exclusiveEnd.getTime())) {
      return '';
    }
    const inclusiveEnd = addDays(exclusiveEnd, -1);
    const formatter = new Intl.DateTimeFormat('ko-KR', {
      month: 'numeric',
      day: 'numeric',
    });
    return `${formatter.format(start)} ~ ${formatter.format(inclusiveEnd)}`;
  } catch {
    return '';
  }
}

function formatDate(dateLike: string, options?: Intl.DateTimeFormatOptions): string {
  try {
    const date = new Date(dateLike);
    if (Number.isNaN(date.getTime())) {
      return dateLike;
    }
    const formatter = new Intl.DateTimeFormat('ko-KR', options);
    return formatter.format(date);
  } catch (error) {
    console.warn('[ScheduleSection] Failed to format date', dateLike, error);
    return dateLike;
  }
}

function formatTimeRange(startISO: string, endISO?: string): string {
  const start = new Date(startISO);
  if (Number.isNaN(start.getTime())) {
    return '시간 미정';
  }

  // 시간이 00:00인 경우 시간 미정으로 표시
  if (start.getHours() === 0 && start.getMinutes() === 0) {
    return '시간 미정';
  }

  const timeFormatter = new Intl.DateTimeFormat('ko-KR', {
    hour: 'numeric',
    minute: '2-digit',
  });

  if (!endISO) {
    return timeFormatter.format(start);
  }

  const end = new Date(endISO);
  if (Number.isNaN(end.getTime())) {
    return timeFormatter.format(start);
  }

  return `${timeFormatter.format(start)} - ${timeFormatter.format(end)}`;
}

function DiagnosticsPanel({
  diagnostics,
  status,
}: {
  diagnostics: ScheduleDiagnostics;
  status: 'idle' | 'running' | 'ready' | 'error';
}) {
  return (
    <div className="relative p-5 mt-8 space-y-4 text-sm text-purple-900 border rounded-3xl border-purple-200/80 bg-white/70">
      <header className="flex flex-col gap-1">
        <h3 className="text-base font-bold text-purple-900/95">진단 로그</h3>
        <p className="text-xs text-purple-800/70">
          {status === 'running' && '진단을 수행하는 중입니다...'}
          {status === 'ready' && '마지막 진단이 완료되었습니다.'}
          {status === 'error' && '진단 요청 중 오류가 발생했습니다.'}
          {status === 'idle' && '최근 진단 결과입니다.'}
        </p>
        {!diagnostics.ok && diagnostics.errorMessage && (
          <p className="p-3 mt-2 text-xs text-red-600 rounded-2xl bg-red-50/80">{diagnostics.errorMessage}</p>
        )}
      </header>

      <ul className="space-y-3">
        {diagnostics.steps.map((step) => (
          <li key={step.id} className="p-4 border shadow-sm rounded-2xl border-purple-100/80 bg-white/90">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-purple-900/95">{step.label}</p>
                <p className="text-xs text-purple-800/70">
                  {formatTimestamp(step.startedAt)} · {Math.max(step.durationMs, 0)}ms
                </p>
              </div>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                  step.status === 'ok' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                }`}
              >
                {step.status === 'ok' ? '성공' : '실패'}
              </span>
            </div>

            {step.metadata && (
              <pre className="p-3 mt-2 text-xs break-words whitespace-pre-wrap rounded-2xl bg-purple-50/70 text-purple-900/80">
                {formatMetadataDisplay(step.metadata)}
              </pre>
            )}

            {step.error && (
              <p className="p-2 mt-2 text-xs text-red-600 rounded-2xl bg-red-50/80">{step.error}</p>
            )}
          </li>
        ))}
      </ul>

      {diagnostics.feed && diagnostics.feed.events.length > 0 && (
        <p className="text-xs text-purple-800/70">
          이벤트 {diagnostics.feed.events.length.toLocaleString('ko-KR')}개가 감지되었습니다.
        </p>
      )}
    </div>
  );
}

function formatTimestamp(value: string): string {
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return new Intl.DateTimeFormat('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  } catch {
    return value;
  }
}

function formatMetadataDisplay(metadata: Record<string, unknown>): string {
  try {
    return JSON.stringify(metadata, null, 2);
  } catch {
    return String(metadata);
  }
}

function ScheduleSkeleton({ daysToShow }: { daysToShow: number }) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
  {Array.from({ length: daysToShow }).map((_, index) => (
          <div
            key={index}
            className="flex flex-col gap-3 rounded-[20px] border border-purple-100/80 bg-white/70 p-3"
          >
            <div className="w-20 h-4 rounded-full animate-pulse bg-purple-200/60" />
            <div className="w-full h-5 rounded-full animate-pulse bg-purple-200/70" />
            <div className="w-3/4 h-5 rounded-full animate-pulse bg-purple-200/50" />
            <div className="w-4/5 h-5 rounded-full animate-pulse bg-purple-200/40" />
          </div>
        ))}
      </div>
    </div>
  );
}
