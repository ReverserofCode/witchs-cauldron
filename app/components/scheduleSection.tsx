'use client'

import { useEffect, useMemo, useState } from 'react'
import SectionCard from './sectionCard'
import type { ScheduleDiagnostics, ScheduleEvent, ScheduleFeed } from '../api/broadCastSchedule/schedule'

type ScheduleStatus = 'idle' | 'loading' | 'ready' | 'error'

interface ScheduleSectionProps {
  className?: string
  limit?: number
}

interface WeekColumn {
  isoDate: string
  dateLabel: string
  weekdayLabel: string
  events: ScheduleEvent[]
  isWeekend: boolean
}
const SCHEDULE_ENDPOINT = '/api/broadCastSchedule'
const MAX_EVENTS_PER_DAY = 4
const DAYS_TO_SHOW = 4

export default function ScheduleSection({
  className,
  limit = MAX_EVENTS_PER_DAY,
}: ScheduleSectionProps) {
  const [status, setStatus] = useState<ScheduleStatus>('idle')
  const [events, setEvents] = useState<ScheduleEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [diagnostics, setDiagnostics] = useState<ScheduleDiagnostics | null>(null)
  const [diagnoseStatus, setDiagnoseStatus] = useState<'idle' | 'running' | 'ready' | 'error'>(
    'idle'
  )
  const [diagnoseError, setDiagnoseError] = useState<string | null>(null)
  const [weekRange, setWeekRange] = useState<{ start: string; end: string } | null>(null)

  const clampedLimit = useMemo(() => {
    if (typeof limit !== 'number' || Number.isNaN(limit)) {
      return MAX_EVENTS_PER_DAY
    }

    const integral = Math.trunc(limit)
    return Math.max(1, Math.min(integral, MAX_EVENTS_PER_DAY))
  }, [limit])

  useEffect(() => {
    let cancelled = false

    async function loadSchedule() {
      setStatus('loading')
      setError(null)
      setDiagnostics(null)
      setDiagnoseStatus('idle')
      setDiagnoseError(null)

      try {
        const res = await fetch(SCHEDULE_ENDPOINT, {
          headers: { accept: 'application/json' },
        })

        if (!res.ok) {
          throw new Error(`요청이 실패했습니다. (${res.status})`)
        }

        const data = (await res.json()) as ScheduleFeed
        if (!cancelled) {
          const { events: upcomingWeek, range } = selectEventsForWeek(
            data.events,
            DAYS_TO_SHOW
          )
          setEvents(upcomingWeek)
          setWeekRange(range)
          setStatus('ready')
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.')
          setStatus('error')
        }
      }
    }

    loadSchedule()

    return () => {
      cancelled = true
    }
  }, [])

  const handleRunDiagnostics = async () => {
    setDiagnoseStatus('running')
    setDiagnoseError(null)

    try {
      const res = await fetch(`${SCHEDULE_ENDPOINT}?debug=1`, {
        headers: { accept: 'application/json' },
        cache: 'no-store',
      })

      if (!res.ok) {
        throw new Error(`진단 요청이 실패했습니다. (${res.status})`)
      }

      const payload = (await res.json()) as {
        diagnostics: ScheduleDiagnostics
        feed: ScheduleFeed | null
        hint?: string
      }

      setDiagnostics(payload.diagnostics)

      const { events: upcomingWeek, range } = selectEventsForWeek(
        payload.feed?.events ?? [],
        DAYS_TO_SHOW
      )
      setEvents(upcomingWeek)
      setWeekRange(range)
      setStatus('ready')

      setDiagnoseStatus('ready')
    } catch (err) {
      setDiagnoseStatus('error')
      setDiagnoseError(err instanceof Error ? err.message : '진단 실행 중 오류가 발생했습니다.')
    }
  }

  const weekColumns = useMemo<WeekColumn[]>(
    () => buildWeekColumns(events, weekRange?.start, clampedLimit),
    [events, weekRange?.start, clampedLimit]
  )

  const hasAnyEvents = useMemo(
    () => weekColumns.some((day) => day.events.length > 0),
    [weekColumns]
  )

  const weekRangeLabel = useMemo(() => formatWeekRangeLabel(weekRange), [weekRange])

  return (
    <SectionCard
      id="schedule-section"
      className={className}
      tone="lavender"
      eyebrow="Broadcast Schedule"
      title="라이브 일정표"
      description={`웹에 게시된 구글 시트를 기반으로 자동 동기화됩니다. 오늘부터 4일간의 방송을 보여주며 하루당 최대 ${clampedLimit}개의 방송을 표시합니다.`}
      bodyClassName="relative"
    >
      {status === 'loading' && <ScheduleSkeleton />}
      {status === 'error' && (
        <div className="space-y-3 rounded-2xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-700">
          <div>
            일정 정보를 불러오지 못했습니다.
            <br />
            {error}
          </div>
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
          {diagnoseStatus === 'error' && diagnoseError && (
            <p className="text-sm text-red-600">{diagnoseError}</p>
          )}
        </div>
      )}
      {status === 'ready' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-purple-800/70">
            {weekRangeLabel && <span>{weekRangeLabel}</span>}
            {!hasAnyEvents && (
              <span className="font-medium text-purple-700">이번 주에는 예정된 방송이 없습니다.</span>
            )}
          </div>

          <div className="overflow-x-auto">
            <ul className="grid min-w-[560px] grid-cols-4 gap-4">
              {weekColumns.map((day) => (
                <li
                  key={day.isoDate}
                  className={`flex min-h-[200px] flex-col rounded-2xl border p-4 shadow-sm transition ${
                    day.isWeekend
                      ? 'border-purple-300/70 bg-purple-50/80'
                      : 'border-white/60 bg-white/80'
                  }`}
                >
                  <header className="mb-3 flex flex-col gap-1">
                    <span
                      className={`text-xs font-semibold uppercase tracking-wide ${
                        day.isWeekend ? 'text-purple-800' : 'text-purple-700/70'
                      }`}
                    >
                      {day.weekdayLabel}
                    </span>
                    <span
                      className={`text-lg font-bold ${
                        day.isWeekend ? 'text-purple-900' : 'text-purple-900/90'
                      }`}
                    >
                      {day.dateLabel}
                    </span>
                  </header>

                  <div className="flex flex-1 flex-col gap-2">
                    {day.events.length > 0 ? (
                      day.events.map((event) => (
                        <article
                          key={event.id}
                          className="rounded-xl border border-purple-100/70 bg-white/90 px-3 py-2 text-xs text-purple-900 shadow-sm"
                        >
                          <p className="line-clamp-2 font-semibold text-purple-900/95">{event.title}</p>
                          <p className="mt-1 text-[11px] font-medium text-purple-700/80">
                            {formatTimeRange(event.start, event.end)}
                          </p>
                          {event.platform && (
                            <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-purple-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-purple-600" aria-hidden />
                              {event.platform}
                            </p>
                          )}
                          {event.description && (
                            <p className="mt-1 line-clamp-2 text-[11px] text-purple-800/80">
                              {event.description}
                            </p>
                          )}
                        </article>
                      ))
                    ) : (
                      <p className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-purple-200/60 bg-white/60 px-3 py-6 text-center text-xs text-purple-700/70">
                        일정 없음
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {diagnostics && <DiagnosticsPanel diagnostics={diagnostics} status={diagnoseStatus} />}
    </SectionCard>
  )
}

function selectEventsForWeek(
  events: ScheduleEvent[],
  daysToShow: number
): { events: ScheduleEvent[]; range: { start: string; end: string } } {
  const start = startOfDay(new Date())
  const end = addDays(start, daysToShow)
  const startMs = start.getTime()
  const endMs = end.getTime()

  const filtered = events
    .filter((event) => {
      const eventStart = Date.parse(event.start)
      if (Number.isNaN(eventStart)) {
        return false
      }

      const eventEndParsed = event.end ? Date.parse(event.end) : Number.NaN
      const eventEnd = Number.isNaN(eventEndParsed) ? eventStart : eventEndParsed

      const startsInRange = eventStart >= startMs && eventStart < endMs
      const endsInRange = eventEnd >= startMs && eventEnd < endMs
      const spansRange = eventStart < startMs && eventEnd >= startMs

      return startsInRange || endsInRange || spansRange
    })
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))

  return {
    events: filtered,
    range: {
      start: start.toISOString(),
      end: end.toISOString(),
    },
  }
}

function buildWeekColumns(
  events: ScheduleEvent[],
  rangeStartIso: string | undefined,
  limitPerDay: number
): WeekColumn[] {
  const start = rangeStartIso ? startOfDay(new Date(rangeStartIso)) : startOfDay(new Date())
  const dateKeyedEvents = new Map<string, ScheduleEvent[]>()

  events.forEach((event) => {
    const eventDate = new Date(event.start)
    if (Number.isNaN(eventDate.getTime())) {
      return
    }
    const key = formatDateKey(eventDate)
    const bucket = dateKeyedEvents.get(key)
    if (bucket) {
      bucket.push(event)
    } else {
      dateKeyedEvents.set(key, [event])
    }
  })

  const dateFormatter = new Intl.DateTimeFormat('ko-KR', {
    month: 'numeric',
    day: 'numeric',
  })
  const weekdayFormatter = new Intl.DateTimeFormat('ko-KR', {
    weekday: 'short',
  })

  return Array.from({ length: DAYS_TO_SHOW }).map((_, index) => {
    const currentDate = addDays(start, index)
    const key = formatDateKey(currentDate)
    const bucket = dateKeyedEvents.get(key) ?? []
    const sorted = bucket.slice().sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
    const limited = sorted.slice(0, limitPerDay)
    const isWeekend = [0, 6].includes(currentDate.getDay())

    return {
      isoDate: key,
      dateLabel: dateFormatter.format(currentDate),
      weekdayLabel: weekdayFormatter.format(currentDate),
      events: limited,
      isWeekend,
    }
  })
}

function startOfDay(date: Date): Date {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function addDays(date: Date, amount: number): Date {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + amount)
  return copy
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatWeekRangeLabel(range: { start: string; end: string } | null): string {
  if (!range) {
    return ''
  }

  try {
    const start = new Date(range.start)
    const exclusiveEnd = new Date(range.end)
    if (Number.isNaN(start.getTime()) || Number.isNaN(exclusiveEnd.getTime())) {
      return ''
    }
    const inclusiveEnd = addDays(exclusiveEnd, -1)
    const formatter = new Intl.DateTimeFormat('ko-KR', {
      month: 'numeric',
      day: 'numeric',
    })
    return `${formatter.format(start)} ~ ${formatter.format(inclusiveEnd)}`
  } catch {
    return ''
  }
}

function formatDate(dateLike: string, options?: Intl.DateTimeFormatOptions): string {
  try {
    const date = new Date(dateLike)
    if (Number.isNaN(date.getTime())) {
      return dateLike
    }
    const formatter = new Intl.DateTimeFormat('ko-KR', options)
    return formatter.format(date)
  } catch (error) {
    console.warn('[ScheduleSection] Failed to format date', dateLike, error)
    return dateLike
  }
}

function formatTimeRange(startISO: string, endISO?: string): string {
  const start = new Date(startISO)
  if (Number.isNaN(start.getTime())) {
    return '시간 미정'
  }

  const timeFormatter = new Intl.DateTimeFormat('ko-KR', {
    hour: 'numeric',
    minute: '2-digit',
  })

  if (!endISO) {
    return timeFormatter.format(start)
  }

  const end = new Date(endISO)
  if (Number.isNaN(end.getTime())) {
    return timeFormatter.format(start)
  }

  return `${timeFormatter.format(start)} - ${timeFormatter.format(end)}`
}

function DiagnosticsPanel({
  diagnostics,
  status,
}: {
  diagnostics: ScheduleDiagnostics
  status: 'idle' | 'running' | 'ready' | 'error'
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
          <p className="p-3 mt-2 text-xs text-red-600 rounded-2xl bg-red-50/80">
            {diagnostics.errorMessage}
          </p>
        )}
      </header>

      <ul className="space-y-3">
        {diagnostics.steps.map((step) => (
          <li
            key={step.id}
            className="p-4 border shadow-sm rounded-2xl border-purple-100/80 bg-white/90"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-purple-900/95">{step.label}</p>
                <p className="text-xs text-purple-800/70">
                  {formatTimestamp(step.startedAt)} · {Math.max(step.durationMs, 0)}ms
                </p>
              </div>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                  step.status === 'ok'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-red-100 text-red-700'
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
              <p className="p-2 mt-2 text-xs text-red-600 rounded-2xl bg-red-50/80">
                {step.error}
              </p>
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
  )
}

function formatTimestamp(value: string): string {
  try {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
      return value
    }
    return new Intl.DateTimeFormat('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    }).format(date)
  } catch {
    return value
  }
}

function formatMetadataDisplay(metadata: Record<string, unknown>): string {
  try {
    return JSON.stringify(metadata, null, 2)
  } catch {
    return String(metadata)
  }
}

function ScheduleSkeleton() {
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[560px] grid-cols-4 gap-4">
        {Array.from({ length: DAYS_TO_SHOW }).map((_, index) => (
          <div
            key={index}
            className="flex flex-col gap-3 p-4 border rounded-2xl border-purple-100/80 bg-white/70"
          >
            <div className="w-20 h-4 rounded-full animate-pulse bg-purple-200/60" />
            <div className="w-full h-5 rounded-full animate-pulse bg-purple-200/70" />
            <div className="w-3/4 h-5 rounded-full animate-pulse bg-purple-200/50" />
            <div className="w-4/5 h-5 rounded-full animate-pulse bg-purple-200/40" />
          </div>
        ))}
      </div>
    </div>
  )
}
