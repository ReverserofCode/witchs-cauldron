'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ScheduleDiagnostics, ScheduleEvent, ScheduleFeed } from '../api/broadCastSchedule/schedule'

type ScheduleStatus = 'idle' | 'loading' | 'ready' | 'error'

interface ScheduleSectionProps {
  className?: string
  limit?: number
}

interface GroupedEvents {
  dateLabel: string
  isoDate: string
  items: ScheduleEvent[]
}

const SCHEDULE_ENDPOINT = '/api/broadCastSchedule'

export default function ScheduleSection({
  className,
  limit = 12,
}: ScheduleSectionProps) {
  const [status, setStatus] = useState<ScheduleStatus>('idle')
  const [events, setEvents] = useState<ScheduleEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [diagnostics, setDiagnostics] = useState<ScheduleDiagnostics | null>(null)
  const [diagnoseStatus, setDiagnoseStatus] = useState<'idle' | 'running' | 'ready' | 'error'>(
    'idle'
  )
  const [diagnoseError, setDiagnoseError] = useState<string | null>(null)

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
          const upcoming = filterUpcoming(data.events)
          setEvents(upcoming.slice(0, limit))
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
  }, [limit])

  const grouped = useMemo(() => groupEventsByDate(events), [events])

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

      if (payload.feed?.events?.length) {
        const upcoming = filterUpcoming(payload.feed.events)
        if (upcoming.length > 0) {
          setEvents(upcoming.slice(0, limit))
          setStatus('ready')
        }
      }

      setDiagnoseStatus('ready')
    } catch (err) {
      setDiagnoseStatus('error')
      setDiagnoseError(err instanceof Error ? err.message : '진단 실행 중 오류가 발생했습니다.')
    }
  }

  return (
    <section
      aria-labelledby="schedule-section-title"
      className={`relative overflow-hidden rounded-3xl border border-white/30 bg-white/60 p-6 shadow-lg backdrop-blur ${className ?? ''}`}
    >
      <div className="absolute rounded-full inset-x-10 -top-24 h-44 bg-purple-300/30 blur-3xl" aria-hidden />
      <div className="absolute bottom-0 w-24 h-24 rounded-full right-6 bg-purple-200/40 blur-2xl" aria-hidden />

      <header className="relative flex flex-col gap-2 mb-6">
        <span className="text-sm font-semibold uppercase tracking-[0.2em] text-purple-700/80">
          Broadcast Schedule
        </span>
        <h2 id="schedule-section-title" className="text-2xl font-black text-purple-900/90">
          라이브 일정표
        </h2>
        <p className="text-sm text-purple-900/70">
          웹에 게시된 구글 시트를 기반으로 자동 동기화됩니다. 최대 {limit}개의 다가오는 일정을 표시합니다.
        </p>
      </header>

      <div className="relative">
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
                className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 font-semibold text-purple-800 shadow-sm transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
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
        {status === 'ready' && grouped.length === 0 && (
          <div className="p-6 text-sm text-center border rounded-2xl border-white/60 bg-white/80 text-purple-900/70">
            예정된 일정이 없습니다. 잠시 후 다시 확인해 주세요.
          </div>
        )}
        {status === 'ready' && grouped.length > 0 && (
          <ul className="space-y-5">
            {grouped.map((group) => (
              <li key={group.isoDate} className="p-4 border shadow-sm rounded-2xl border-white/60 bg-white/80">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs tracking-wide uppercase text-purple-700/70">{group.dateLabel}</p>
                    <p className="text-lg font-bold text-purple-900/90">
                      {formatDate(group.isoDate, { weekday: 'long' })}
                    </p>
                  </div>
                  <div className="px-3 py-1 text-xs font-semibold text-purple-700 bg-purple-100 rounded-full">
                    {group.items.length}개의 이벤트
                  </div>
                </div>

                <ul className="space-y-3">
                  {group.items.map((event) => (
                    <li
                      key={event.id}
                      className="flex flex-col gap-2 rounded-xl border border-purple-100/80 bg-white/90 px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-base font-semibold text-purple-900/95">{event.title}</div>
                        <span className="rounded-full bg-purple-200/60 px-2.5 py-1 text-xs font-semibold text-purple-800">
                          {formatTimeRange(event.start, event.end)}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-purple-800/80">
                        <span>{formatDate(event.start, { dateStyle: 'medium' })}</span>
                        {event.platform && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 font-medium text-purple-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-purple-600" aria-hidden />
                            {event.platform}
                          </span>
                        )}
                      </div>
                      {event.description && (
                        <p className="text-sm text-purple-900/75">{event.description}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
        {diagnostics && (
          <DiagnosticsPanel diagnostics={diagnostics} status={diagnoseStatus} />
        )}
      </div>
    </section>
  )
}

function filterUpcoming(events: ScheduleEvent[]): ScheduleEvent[] {
  const now = Date.now()
  return events
    .filter((event) => {
      const start = Date.parse(event.start)
      if (Number.isNaN(start)) {
        return false
      }
      if (start >= now) {
        return true
      }
      if (event.end) {
        const end = Date.parse(event.end)
        if (!Number.isNaN(end) && end >= now) {
          return true
        }
      }
      return false
    })
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
}

function groupEventsByDate(events: ScheduleEvent[]): GroupedEvents[] {
  const formatter = new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const groups = new Map<string, GroupedEvents>()

  events.forEach((event) => {
    const date = new Date(event.start)
    const isoDate = date.toISOString().split('T')[0]
    const existing = groups.get(isoDate)
    if (existing) {
      existing.items.push(event)
    } else {
      groups.set(isoDate, {
        isoDate,
        dateLabel: formatter.format(date),
        items: [event],
      })
    }
  })

  return Array.from(groups.values()).sort((a, b) => (a.isoDate < b.isoDate ? -1 : 1))
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
    <div className="relative mt-8 space-y-4 rounded-3xl border border-purple-200/80 bg-white/70 p-5 text-sm text-purple-900">
      <header className="flex flex-col gap-1">
        <h3 className="text-base font-bold text-purple-900/95">진단 로그</h3>
        <p className="text-xs text-purple-800/70">
          {status === 'running' && '진단을 수행하는 중입니다...'}
          {status === 'ready' && '마지막 진단이 완료되었습니다.'}
          {status === 'error' && '진단 요청 중 오류가 발생했습니다.'}
          {status === 'idle' && '최근 진단 결과입니다.'}
        </p>
        {!diagnostics.ok && diagnostics.errorMessage && (
          <p className="mt-2 rounded-2xl bg-red-50/80 p-3 text-xs text-red-600">
            {diagnostics.errorMessage}
          </p>
        )}
      </header>

      <ul className="space-y-3">
        {diagnostics.steps.map((step) => (
          <li
            key={step.id}
            className="rounded-2xl border border-purple-100/80 bg-white/90 p-4 shadow-sm"
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
              <pre className="mt-2 whitespace-pre-wrap break-words rounded-2xl bg-purple-50/70 p-3 text-xs text-purple-900/80">
                {formatMetadataDisplay(step.metadata)}
              </pre>
            )}

            {step.error && (
              <p className="mt-2 rounded-2xl bg-red-50/80 p-2 text-xs text-red-600">
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
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="p-4 space-y-3 border rounded-2xl border-purple-100/80 bg-white/70">
          <div className="w-32 h-4 rounded-full animate-pulse bg-purple-200/60" />
          <div className="w-full h-5 rounded-full animate-pulse bg-purple-200/70" />
          <div className="w-2/3 h-5 rounded-full animate-pulse bg-purple-200/50" />
        </div>
      ))}
    </div>
  )
}
