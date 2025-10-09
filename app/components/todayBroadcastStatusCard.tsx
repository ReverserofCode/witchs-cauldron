'use client'

import { useEffect, useMemo, useState, type ReactElement } from 'react'
import SectionCard from './sectionCard'
import type { ScheduleEvent, ScheduleFeed } from '../api/broadCastSchedule/schedule'

const SCHEDULE_ENDPOINT = '/api/broadCastSchedule'

type LoadState = 'idle' | 'loading' | 'ready' | 'error'

interface TodayBroadcastStatusCardProps {
  className?: string
}

export default function TodayBroadcastStatusCard({ className }: TodayBroadcastStatusCardProps = {}): ReactElement {
  const [status, setStatus] = useState<LoadState>('idle')
  const [events, setEvents] = useState<ScheduleEvent[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadToday() {
      setStatus('loading')
      setError(null)

      try {
        const res = await fetch(SCHEDULE_ENDPOINT, {
          headers: { accept: 'application/json' },
        })

        if (!res.ok) {
          throw new Error(`요청이 실패했습니다. (${res.status})`)
        }

        const data = (await res.json()) as ScheduleFeed
        if (!cancelled) {
          const todayEvents = selectTodayEvents(data.events)
          setEvents(todayEvents)
          setStatus('ready')
        }
      } catch (err) {
        if (!cancelled) {
          setStatus('error')
          setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.')
        }
      }
    }

    loadToday()

    return () => {
      cancelled = true
    }
  }, [])

  const sortedEvents = useMemo(
    () => events.slice().sort((a, b) => Date.parse(a.start) - Date.parse(b.start)),
    [events]
  )

  const firstEvent = sortedEvents[0] ?? null
  const remainingEvents = useMemo(() => sortedEvents.slice(1, 4), [sortedEvents])

  const statusBadge = useMemo(() => {
    if (status === 'loading') {
      return {
        label: '확인 중',
        className: 'bg-purple-100 text-purple-700',
      }
    }

    if (status === 'error') {
      return {
        label: '오류',
        className: 'bg-red-100 text-red-700',
      }
    }

    if (events.length > 0) {
      return {
        label: '진행 예정',
        className: 'bg-emerald-100 text-emerald-700',
      }
    }

    return {
      label: '휴방',
      className: 'bg-slate-200 text-slate-700',
    }
  }, [events.length, status])

  return (
    <SectionCard
      className={className}
      tone="lavender"
      eyebrow="Today&apos;s Broadcast"
      title="오늘 방송 상태"
      actions={
        <span
          className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-semibold ${statusBadge.className}`}
        >
          {statusBadge.label}
        </span>
      }
      bodyClassName="gap-8"
      footer="데이터는 최신 구글 시트 기준으로 자동 동기화됩니다."
    >
      <div className="flex flex-col gap-4">
        {status !== 'ready' && (
          <div className="p-4 border rounded-2xl border-purple-200/70 bg-white/80">
            {status === 'loading' ? <LoadingState /> : null}
            {status === 'error' && (
              <p className="text-sm text-red-700 typography-body">
                상태를 불러오지 못했습니다.
                <br />
                {error}
              </p>
            )}
          </div>
        )}

        {status === 'ready' && (
          <div className="flex flex-col gap-3">
            {firstEvent ? (
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 border shadow-sm rounded-2xl border-white/60 bg-white/85">
                <div className="min-w-0 space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-purple-700/80">Upcoming</p>
                  <p className="text-base font-bold text-purple-900/95 typography-heading line-clamp-2">
                    {firstEvent.title}
                  </p>
                  {firstEvent.description && (
                    <p className="text-[11px] text-purple-700/80 typography-small line-clamp-2">
                      {firstEvent.description}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 text-xs text-purple-700/90">
                  <span className="inline-flex items-center gap-2 px-3 py-1 text-purple-800 rounded-full bg-purple-100/80">
                    {formatTimeRange(firstEvent.start, firstEvent.end)}
                  </span>
                  <span className="text-[11px] font-medium text-purple-600">{formatDateLabel(firstEvent.start)}</span>
                  {firstEvent.platform && (
                    <span className="inline-flex items-center gap-1 text-purple-700/90">
                      <span className="h-1.5 w-1.5 rounded-full bg-purple-600" aria-hidden />
                      {firstEvent.platform}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4 text-sm font-medium border shadow-sm rounded-2xl border-white/60 bg-white/85 text-purple-700/80 typography-body">
                오늘은 예정된 방송이 없습니다. 휴식을 즐겨보세요!
              </div>
            )}

            {remainingEvents.length > 0 && (
              <div className="overflow-x-auto">
                <ul className="flex min-w-full gap-3">
                  {remainingEvents.map((event) => (
                    <li
                      key={event.id}
                      className="flex min-w-[170px] flex-col gap-2 rounded-2xl border border-purple-100/80 bg-white/90 p-3 text-xs text-purple-800/80 typography-small"
                    >
                      <div className="flex items-center justify-between text-[11px] text-purple-700/80">
                        <span className="font-semibold text-purple-900/85">{formatTimeRange(event.start, event.end)}</span>
                        {event.platform && (
                          <span className="inline-flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-purple-500" aria-hidden />
                            {event.platform}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-purple-900/95 typography-body line-clamp-2">
                        {event.title}
                      </p>
                      {event.description && (
                        <p className="text-[11px] text-purple-700/70 line-clamp-2">{event.description}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </SectionCard>
  )
}

function selectTodayEvents(events: ScheduleEvent[]): ScheduleEvent[] {
  const start = startOfDay(new Date())
  const end = addDays(start, 1)
  const startMs = start.getTime()
  const endMs = end.getTime()

  return events
    .filter((event) => {
      const eventStart = Date.parse(event.start)
      if (Number.isNaN(eventStart)) {
        return false
      }

      const eventEndParsed = event.end ? Date.parse(event.end) : Number.NaN
      const eventEnd = Number.isNaN(eventEndParsed) ? eventStart : eventEndParsed

      const startsToday = eventStart >= startMs && eventStart < endMs
      const endsToday = eventEnd >= startMs && eventEnd < endMs
      const spansToday = eventStart < startMs && eventEnd >= startMs

      return startsToday || endsToday || spansToday
    })
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
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

function formatTime(dateISO: string): string {
  try {
    const date = new Date(dateISO)
    if (Number.isNaN(date.getTime())) {
      return '시간 미정'
    }

    return new Intl.DateTimeFormat('ko-KR', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date)
  } catch {
    return '시간 미정'
  }
}

function formatTimeRange(startISO: string, endISO?: string): string {
  const startFormatted = formatTime(startISO)
  if (!endISO) {
    return startFormatted
  }
  const endFormatted = formatTime(endISO)
  if (endFormatted === startFormatted) {
    return startFormatted
  }
  return `${startFormatted} ~ ${endFormatted}`
}

function formatDateLabel(dateISO: string): string {
  try {
    const date = new Date(dateISO)
    if (Number.isNaN(date.getTime())) {
      return ''
    }
    return new Intl.DateTimeFormat('ko-KR', {
      month: 'numeric',
      day: 'numeric',
      weekday: 'short',
    }).format(date)
  } catch {
    return ''
  }
}

function LoadingState() {
  return (
    <div className="space-y-2">
      <div className="w-24 h-4 rounded-full animate-pulse bg-purple-200/70" />
      <div className="w-3/4 h-5 rounded-full animate-pulse bg-purple-200/60" />
      <div className="w-1/2 h-4 rounded-full animate-pulse bg-purple-200/50" />
    </div>
  )
}

function TimelineSkeleton() {
  return (
    <ul className="space-y-4">
      {Array.from({ length: 3 }).map((_, index) => (
        <li key={index} className="grid grid-cols-[auto_1fr] gap-3">
          <div className="relative flex flex-col items-center">
            <span className="w-2 h-2 mt-1 bg-purple-200 rounded-full" aria-hidden />
            {index < 2 && <span className="flex-1 w-px bg-purple-100" aria-hidden />}
          </div>
          <div className="space-y-2">
            <div className="w-16 h-3 rounded-full bg-purple-200/60" />
            <div className="w-32 h-4 rounded-full bg-purple-200/70" />
            <div className="w-24 h-3 rounded-full bg-purple-200/50" />
          </div>
        </li>
      ))}
    </ul>
  )
}
