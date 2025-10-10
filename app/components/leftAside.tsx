"use client"

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useState, type ReactElement } from 'react'
import SectionCard from './sectionCard'
import YouTubeSectionStatus from './YouTubeSectionStatus'
import { useYouTubeVideos } from '../hooks/useYouTubeVideos'
import type { ScheduleEvent, ScheduleFeed } from '../api/broadCastSchedule/schedule'

type FetchStatus = 'idle' | 'loading' | 'ready' | 'error'

const SCHEDULE_ENDPOINT = '/api/broadCastSchedule'
const TOP_VIDEO_ENDPOINT = '/api/youTubePlayer/topOfficial'
const MAX_VISIBLE_EVENTS = 3

const TABLE_OF_CONTENTS = [
    { id: 'featured-latest', label: '최신 영상' },
    { id: 'featured-top', label: '지난달 최다 조회수' },
    { id: 'schedule-section', label: '방송 일정' },
    { id: 'youtube-official', label: '공식 채널' },
    { id: 'youtube-full', label: '다시보기' },
    { id: 'youtube-fan', label: '팬 하이라이트' },
]

interface FanArtImage {
    src: string
    alt: string
    download?: string
    credit?: string
}

interface LeftAsideProps {
    className?: string
    images?: FanArtImage[]
}

interface TopVideoPayload {
    videoId: string
    title: string
    thumbnail: string
    channelTitle: string
    publishedAt: string
    url: string
    viewCount: number | null
}

const defaultImages: FanArtImage[] = []

export default function LeftAside({ className, images }: LeftAsideProps = {}): ReactElement {
    const [scheduleStatus, setScheduleStatus] = useState<FetchStatus>('idle')
    const [events, setEvents] = useState<ScheduleEvent[]>([])
    const [scheduleError, setScheduleError] = useState<string | null>(null)

    const [topVideoStatus, setTopVideoStatus] = useState<FetchStatus>('idle')
    const [topVideo, setTopVideo] = useState<TopVideoPayload | null>(null)
    const [topVideoError, setTopVideoError] = useState<string | null>(null)

    const { data: youtubeData, status: youtubeStatus, error: youtubeError } = useYouTubeVideos()

    useEffect(() => {
        let cancelled = false

        async function loadSchedule() {
            setScheduleStatus('loading')
            setScheduleError(null)

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
                setScheduleStatus('ready')
            } catch (err) {
                if (cancelled) return
                setScheduleError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.')
                setScheduleStatus('error')
            }
        }

        loadSchedule()

        return () => {
            cancelled = true
        }
    }, [])

    useEffect(() => {
        let cancelled = false

        async function loadTopVideo() {
            setTopVideoStatus('loading')
            setTopVideoError(null)

            try {
                const res = await fetch(TOP_VIDEO_ENDPOINT, {
                    headers: { accept: 'application/json' },
                    cache: 'no-store',
                })

                if (!res.ok) {
                    throw new Error(`영상 정보를 불러오지 못했습니다. (${res.status})`)
                }

                const payload = (await res.json()) as { video: TopVideoPayload | null }
                export { default } from './layout/LeftSidebar'

