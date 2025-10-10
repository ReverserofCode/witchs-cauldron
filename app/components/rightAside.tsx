"use client"

// 우측 사이드바: 추가 정보나 배너 영역
import Image from 'next/image'
import Link from 'next/link'
import { type ReactElement, useEffect, useMemo, useState } from 'react'
import SectionCard from './sectionCard'
import type { ScheduleEvent, ScheduleFeed } from '../api/broadCastSchedule/schedule'

type FetchStatus = 'idle' | 'loading' | 'ready' | 'error'

const SCHEDULE_ENDPOINT = '/api/broadCastSchedule'
const MAX_VISIBLE_EVENTS = 3

interface RightAsideProps {
    className?: string
}

export default function RightAside({ className }: RightAsideProps = {}): ReactElement {
    const [status, setStatus] = useState<FetchStatus>('idle')
    const [events, setEvents] = useState<ScheduleEvent[]>([])
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false

        async function loadSchedule() {
            setStatus('loading')
            setError(null)

            try {
                const response = await fetch(SCHEDULE_ENDPOINT, {
                    headers: { accept: 'application/json' },
                    cache: 'no-store',
                })

                if (!response.ok) {
                    throw new Error(`일정 정보를 불러오지 못했습니다. (${response.status})`)
                }

                const payload = (await response.json()) as ScheduleFeed
                if (cancelled) return

                setEvents(selectUpcomingEvents(payload.events))
                setStatus('ready')
            } catch (err) {
                if (cancelled) return
                setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.')
                setStatus('error')
            }
        }

        loadSchedule()

        return () => {
            cancelled = true
        }
    }, [])

    const upcomingEvents = useMemo(() => selectUpcomingEvents(events, MAX_VISIBLE_EVENTS), [events])
    const nextEventLabel = useMemo(() =>
        upcomingEvents.length > 0 ? formatEventDateTime(upcomingEvents[0]) : null,
    [upcomingEvents])

    return (
        <aside
            className={[
                'flex h-full w-full max-w-[200px] flex-col gap-4 rounded-3xl border border-white/15 bg-white/10 p-4 shadow-lg shadow-purple-950/20 backdrop-blur-lg lg:max-w-[220px] xl:max-w-[240px]',
                className,
            ].filter(Boolean).join(' ')}
        >
            <SectionCard
                tone="neutral"
                className="shadow-md rounded-2xl border-white/40 bg-white/70 shadow-purple-900/10"
                bodyClassName="gap-3"
                eyebrow="Schedule"
                title="빠른 방송 일정"
                description={nextEventLabel ? `다음 방송 · ${nextEventLabel}` : undefined}
            >
                {status === 'loading' && <ScheduleAsideSkeleton />}
                {status === 'error' && error && (
                    <p className="rounded-xl border border-red-200 bg-red-50/80 px-3 py-2 text-[11px] text-red-600">
                        {error}
                    </p>
                )}
                {status === 'ready' && upcomingEvents.length === 0 && (
                    <p className="rounded-xl border border-dashed border-purple-200/60 bg-white/70 px-3 py-4 text-center text-[11px] text-purple-700/70">
                        예정된 방송이 없습니다.
                    </p>
                )}
                {status === 'ready' && upcomingEvents.length > 0 && (
                    <ul className="space-y-2 text-[11px] text-purple-950/85">
                        {upcomingEvents.map((event) => (
                            <li
                                key={event.id}
                                className="flex items-start justify-between gap-2 px-3 py-2 shadow-sm rounded-xl bg-purple-100/40"
                            >
                                <div className="flex flex-col gap-1">
                                    <span className="font-semibold leading-snug text-purple-950/95 line-clamp-2">
                                        {event.title}
                                    </span>
                                    <span className="text-[10px] font-medium text-purple-700/80">
                                        {formatEventDateTime(event)}
                                    </span>
                                </div>
                                {event.platform && (
                                    <span className="mt-1 inline-flex shrink-0 items-center rounded-full bg-purple-200/80 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-purple-900/80">
                                        {event.platform}
                                    </span>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
                <Link href="#schedule-section" className="btn btn-primary mt-2 w-full justify-center text-[11px]">
                    일정 보기
                </Link>
            </SectionCard>

            <SectionCard
                tone="lavender"
                className="shadow-md rounded-2xl border-white/40 bg-gradient-to-br from-purple-100/70 via-white/70 to-white/90 shadow-purple-900/15"
                bodyClassName="gap-4"
                eyebrow="Community"
                title="모잉 디스코드"
            >
                <div className="relative overflow-hidden border shadow-lg rounded-2xl border-white/40 bg-white/60 shadow-purple-900/15">
                    {/* <Image
                        src="/rightAside/rightSide.png"
                        alt="모잉 커뮤니티"
                        width={320}
                        height={180}
                        className="object-cover w-full h-auto"
                        priority
                    /> */}
                </div>
                <div className="flex flex-col gap-1.5 text-[11px] text-purple-900/80">
                    <p className="font-semibold">비밀 재료는 팬들과 함께 나눠요.</p>
                    <p className="text-purple-900/60">디스코드에 참여하고 라이브 소식을 받아보세요.</p>
                </div>
                <div className="flex flex-col gap-1.5">
                    {/* 디스코드 외에 다른 활성화 커뮤니티 없음 */}
                    <a href="https://discord.com/invite/DhuzudS" target="_blank" rel="noreferrer" className="justify-center w-full text-[11px] btn btn-ghost">
                        디스코드 입장하기
                    </a>
                </div>
            </SectionCard>
        </aside>
    )
}

function selectUpcomingEvents(allEvents: ScheduleEvent[], limit: number = MAX_VISIBLE_EVENTS): ScheduleEvent[] {
    const now = Date.now()

    const scored = allEvents
        .map((event) => {
            const start = Date.parse(event.start)
            if (Number.isNaN(start)) {
                return null
            }
            const end = event.end ? Date.parse(event.end) : Number.NaN
            const normalizedEnd = Number.isNaN(end) ? start : end
            const isUpcoming = start >= now || normalizedEnd >= now
            return { event, start, normalizedEnd, isUpcoming }
        })
        .filter((value): value is NonNullable<typeof value> => Boolean(value))
        .sort((a, b) => a.start - b.start)

    const upcoming = scored.filter((item) => item.isUpcoming)
    const source = upcoming.length > 0 ? upcoming : scored

    return source.slice(0, limit).map((item) => item.event)
}

function formatEventDateTime(event: ScheduleEvent): string {
    const start = Date.parse(event.start)
    if (Number.isNaN(start)) {
        return '시간 미정'
    }

    const startDate = new Date(start)
    const formatter = new Intl.DateTimeFormat('ko-KR', {
        month: 'numeric',
        day: 'numeric',
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
    })

    if (!event.end) {
        return formatter.format(startDate)
    }

    const end = Date.parse(event.end)
    if (Number.isNaN(end)) {
        return formatter.format(startDate)
    }

    const endDate = new Date(end)
    const endFormatter = new Intl.DateTimeFormat('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
    })

    return `${formatter.format(startDate)} · ${endFormatter.format(endDate)}`
}

function ScheduleAsideSkeleton(): ReactElement {
    return (
        <ul className="space-y-2">
            {Array.from({ length: MAX_VISIBLE_EVENTS }).map((_, index) => (
                <li
                    key={index}
                    className="flex items-center justify-between px-3 py-2 animate-pulse rounded-xl bg-purple-100/30"
                >
                    <div className="flex flex-col w-full gap-2">
                        <span className="w-full h-4 rounded-full bg-purple-200/60" />
                        <span className="w-2/3 h-3 rounded-full bg-purple-200/50" />
                    </div>
                </li>
            ))}
        </ul>
    )
}
