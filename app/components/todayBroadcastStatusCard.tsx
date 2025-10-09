'use client'

import { useEffect, useMemo, useState, type ReactElement } from 'react'
import SectionCard from './sectionCard'
import type { ScheduleEvent, ScheduleFeed } from '../api/broadCastSchedule/schedule'

const SCHEDULE_ENDPOINT = '/api/broadCastSchedule'

type LoadState = 'idle' | 'loading' | 'ready' | 'error'

export default function TodayBroadcastStatusCard(): ReactElement {
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

  const firstEvent = useMemo(() => {
    if (events.length === 0) {
      return null
    }

    return events
      .slice()
      .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))[0]
  }, [events])

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
      bodyClassName="justify-between gap-6"
      footer="데이터는 최신 구글 시트 기준으로 자동 동기화됩니다."
    >
      <div className="flex flex-col justify-center flex-1 gap-3 text-sm text-purple-900 typography-body">
        {status === 'loading' && <LoadingState />}
        {status === 'error' && (
          <p className="leading-relaxed text-red-700 typography-body">
            상태를 불러오지 못했습니다.
            <br />
            {error}
          </p>
        )}
        {status === 'ready' && events.length === 0 && (
          <p className="font-medium leading-relaxed text-purple-800/80 typography-body">
            오늘은 예정된 방송이 없습니다. 휴식을 즐겨보세요!
          </p>
        )}
        {status === 'ready' && firstEvent && (
          <div className="space-y-2">
            <p className="font-semibold text-purple-900/90 typography-body">다음 방송</p>
            <p className="text-base font-bold text-purple-900/95 typography-heading">{firstEvent.title}</p>
            <p className="text-xs font-medium text-purple-700/80 typography-small">
              {formatTime(firstEvent.start)}
              {firstEvent.end ? ` ~ ${formatTime(firstEvent.end)}` : ''}
            </p>
            {firstEvent.platform && (
              <p className="inline-flex items-center gap-1 text-xs font-semibold text-purple-700 typography-small">
                <span className="h-1.5 w-1.5 rounded-full bg-purple-600" aria-hidden />
                {firstEvent.platform}
              </p>
            )}
            {firstEvent.description && (
              <p className="text-xs text-purple-700/80 line-clamp-3 typography-small">{firstEvent.description}</p>
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

function LoadingState() {
  return (
    <div className="space-y-2">
      <div className="w-24 h-4 rounded-full animate-pulse bg-purple-200/70" />
      <div className="w-3/4 h-5 rounded-full animate-pulse bg-purple-200/60" />
      <div className="w-1/2 h-4 rounded-full animate-pulse bg-purple-200/50" />
    </div>
  )
}
