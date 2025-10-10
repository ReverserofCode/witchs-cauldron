// Home page (App Router)
// - 메인 레이아웃: 3열 Grid (LeftAside | Content | RightAside)
// - HERO 섹션: 텍스트 2컬럼 + 아바타 1컬럼
// - ABOUT 섹션: 브랜드 컬러 카드
import Image from 'next/image'
import { ReactElement } from 'react'
import { getChzzkLiveStatus } from './api/chzzkPlayer/chzzkPlayer'
import profileImg from '../public/mainPage/Profile.png'
import { LeftSidebar, RightSidebar } from '@/app/components/layout'
import { SectionCard, LatestYouTubeVideoCard, TopOfficialYouTubeVideoCard } from '@/app/components/cards'
import {
  ScheduleSection,
  YouTubeOfficialVideosSection,
  YouTubeFullMoingVideosSection,
  YouTubeFanVideosSection,
} from '@/app/components/sections'


export default async function Page(): Promise<ReactElement> {
  const liveStatus = await getChzzkLiveStatus()
  const liveChipClass = `chip inline-flex items-center gap-1.5 border ${liveStatus.isLive ? 'bg-rose-500/90 border-rose-300/60 text-white' : 'bg-slate-700/80 border-slate-600/70 text-slate-100'}`
  const viewerText =
    liveStatus.isLive && typeof liveStatus.viewers === 'number' && Number.isFinite(liveStatus.viewers)
      ? ` • ${liveStatus.viewers.toLocaleString()}명 시청중`
      : ''
  const liveChipLabel = liveStatus.isLive ? `실시간 방송 중${viewerText}` : '현재 오프라인'
  const liveStatusDescription = liveStatus.error
    ? '다음 방송을 기다려주세요.'
    : liveStatus.isLive
    ? '모잉이 지금도 마법을 선보이는 중입니다!'
    : '다음 방송을 기다려주세요.'

  return (
    <main className="py-10 lg:py-16">
      <div className="w-full px-4 mx-auto max-w-7xl sm:px-6 lg:px-8">
        <div className="grid w-full grid-cols-1 gap-4 lg:grid-cols-[minmax(180px,0.7fr)_minmax(0,2.6fr)_minmax(180px,0.7fr)] xl:grid-cols-[minmax(200px,0.8fr)_minmax(0,2.4fr)_minmax(200px,0.8fr)] xl:gap-6">
          {/* Left Aside */}
          <LeftSidebar className="hidden lg:flex lg:sticky lg:top-24" />
          {/* Center Content Wrapper: 중앙 컬럼에 본문을 모아 배치 */}
          <div className="flex min-w-0 flex-col gap-14 text-[15px] leading-relaxed lg:px-3">
            {/* HERO */}
            {/* 텍스트 2, 이미지 1 비율의 그리드 */}
            {/* 초기 소개용 섹션 */}
            <div className="flex flex-col w-full gap-10 Intro-section">
              <SectionCard
                tone="dimmed"
                header={
                  <div className="grid items-center gap-8 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
                    <div className="space-y-4 text-white">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="chip">KR V-tuber • Moing</span>
                        <a
                          href={liveStatus.channelUrl}
                          target="_blank"
                          rel="noreferrer"
                          className={liveChipClass}
                        >
                          <span className="inline-block w-2 h-2 bg-current rounded-full" />
                          {liveChipLabel}
                        </a>
                      </div>
                      <h1 className="text-3xl font-extrabold typography-heading md:text-4xl">
                        마녀의 포션 공방
                      </h1>
                      <div className="space-y-2.5">
                        <p className="text-base font-light typography-lead max-w-prose">
                          포션을 만들면 폭발하거나, 고백하게 만드는 재앙 제조기. “진짜 감기약 맞아요?” 음... 아마도요.
                        </p>
                        <p className="text-base font-light opacity-0 typography-lead animate-fade-in animation-delay-200">
                          {liveStatusDescription}
                        </p>
                      </div>
                    </div>
                    <div className="profile-avatar justify-self-end">
                      <div className="relative w-32 h-32 md:h-48 md:w-48" aria-hidden>
                        <div className="w-full h-full avatar-frame">
                          <div className="glow" />
                          <Image
                            src={profileImg}
                            alt="Moing"
                            fill
                            sizes="(min-width: 768px) 208px, 144px"
                            className="object-cover"
                            priority
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                }
              >
                <p className="text-sm typography-body text-purple-100/80">
                  팬 여러분이 가장 궁금해하는 정보, 최신 방송 일정, 그리고 하이라이트 영상들을 한 곳에 모았습니다.
                </p>
              </SectionCard>

              <div className="grid gap-5 md:grid-cols-1 lg:grid-cols-2">
                <div id="featured-latest" className="h-full">
                  <LatestYouTubeVideoCard className="h-full" />
                </div>
                <div id="featured-top" className="h-full">
                  <TopOfficialYouTubeVideoCard className="h-full" />
                </div>
              </div>
              <div id="schedule-section">
                <ScheduleSection />
              </div>
              <div id="youtube-official">
                <YouTubeOfficialVideosSection />
              </div>
              <div id="youtube-full">
                <YouTubeFullMoingVideosSection />
              </div>
              <div id="youtube-fan">
                <YouTubeFanVideosSection />
              </div>
              {/* <YouTubeShortsSection /> */}
            </div>

            <div className="mt-1 space-y-10">
              {/* 유튜브 카테고리별 컴포넌트 분화 */}
              {/* <YouTubeVideosSection /> */}
              {/* 적절한 쇼츠 채널이 없어 임시 폐쇄  */}
              {/* <YouTubeShortsSection /> */}
            </div>
          </div>
          {/* Right Aside */}
          <RightSidebar className="hidden lg:flex lg:sticky lg:top-24" />
        </div>
      </div>
    </main>
  )
}
