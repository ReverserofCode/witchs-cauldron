// Home page (App Router)
// - 메인 레이아웃: 3열 Grid (LeftAside | Content | RightAside)
// - HERO 섹션: 텍스트 2컬럼 + 아바타 1컬럼
// - ABOUT 섹션: 브랜드 컬러 카드
import Image from 'next/image'
import { ReactElement } from 'react'
import { getChzzkLiveStatus } from './api/chzzkPlayer/chzzkPlayer'
import profileImg from '../public/mainPage/Profile.png'
import { LeftSidebar, RightSidebar } from '@/app/components/layout'
import { SectionCard } from '@/app/components/cards'
import {
  ClipsSection,
  ScheduleSection,
  FeaturedVideoSection,
  YouTubeHubSection,
} from '@/app/components/sections'
import { SectionTracker } from '@/app/components/analytics/SectionTracker'
import { ScrollReveal } from '@/app/components/animations'
import { FanArtGallery } from '@/app/components/gallery'
import { loadFanArtImages } from '@/app/lib/fanart'

export const dynamic = 'force-dynamic'

const MOBILE_QUICK_LINKS = [
  { label: '치지직', href: 'https://chzzk.naver.com/1d333ff175b4db5bd06f87a88579ec1e' },
  { label: '유튜브', href: 'https://www.youtube.com/channel/UCHzre37UF4o64HRhp-7CDzQ' },
  { label: '다시보기', href: 'https://www.youtube.com/@fullmoing' },
  { label: '팬카페', href: 'https://cafe.naver.com/moinge' },
  { label: '분석 대시보드', href: '/admin/analytics' },
]

const SEO_FAQ = [
  {
    q: '모잉 방송 일정은 어디서 확인할 수 있나요?',
    a: '메인 페이지의 방송 일정 섹션에서 최근 일정과 예정 방송을 확인할 수 있습니다.',
  },
  {
    q: '모잉 유튜브 최신 영상과 다시보기는 어떻게 보나요?',
    a: 'YouTube 허브 섹션에서 공식 채널과 다시보기 채널 영상을 함께 확인할 수 있습니다.',
  },
  {
    q: '모잉 하이라이트 숏폼과 클립도 볼 수 있나요?',
    a: '숏폼 하이라이트 섹션에서 YouTube Shorts와 클립을 모아서 볼 수 있습니다.',
  },
]

export default async function Page(): Promise<ReactElement> {
  const fanArtImages = loadFanArtImages()
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
          <div className="flex min-w-0 flex-col gap-10 text-[15px] leading-relaxed lg:px-3">
            {/* HERO */}
            {/* 텍스트 2, 이미지 1 비율의 그리드 */}
            {/* 초기 소개용 섹션 */}
            <div className="flex flex-col w-full gap-10 Intro-section">
              <SectionCard
                tone="dimmed"
                header={
                  <div className="flex items-center gap-4 sm:gap-6 md:gap-8">
                    <div className="flex-1 min-w-0 space-y-3 text-white sm:space-y-4">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <span className="chip text-xs sm:text-sm">KR V-tuber • Moing</span>
                        <a
                          href={liveStatus.channelUrl}
                          target="_blank"
                          rel="noreferrer"
                          className={`${liveChipClass} transition-all duration-200 hover:scale-105 hover:brightness-110`}
                        >
                          <span className="inline-block w-1.5 h-1.5 sm:w-2 sm:h-2 bg-current rounded-full" />
                          <span className="text-xs sm:text-sm">{liveChipLabel}</span>
                        </a>
                      </div>
                      <h1 className="text-xl font-extrabold typography-heading sm:text-2xl md:text-4xl">
                        마녀의 포션 공방
                      </h1>
                      <div className="space-y-2 sm:space-y-2.5">
                        <p className="text-sm font-light typography-lead max-w-prose sm:text-base">
                          포션을 만들면 폭발하거나, 고백하게 만드는 재앙 제조기. &quot;진짜 감기약 맞아요?&quot; 음... 아마도요.
                        </p>
                        <p className="text-xs font-medium text-purple-100/90 sm:text-sm">
                          패러블 엔터테인먼트 소속 버튜버
                        </p>
                        <p className="text-sm font-light opacity-0 typography-lead animate-fade-in animation-delay-200 sm:text-base">
                          {liveStatusDescription}
                        </p>
                      </div>
                    </div>
                    <div className="profile-avatar flex-shrink-0">
                      <div className="relative w-20 h-20 sm:w-28 sm:h-28 md:h-48 md:w-48" aria-hidden>
                        <div className="w-full h-full avatar-frame">
                          <div className="glow" />
                          <Image
                            src={profileImg}
                            alt="Moing"
                            fill
                            sizes="(min-width: 768px) 192px, (min-width: 640px) 112px, 80px"
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

              <ScrollReveal>
                <SectionCard
                  tone="lavender"
                  className="lg:hidden"
                  eyebrow="Quick Access"
                  title="모바일 빠른 이동"
                  description="사이드바 핵심 정보와 링크를 모바일 화면에서도 바로 확인하세요."
                >
                  <div className="grid grid-cols-2 gap-2">
                    {MOBILE_QUICK_LINKS.map((link) => {
                      const isExternal = link.href.startsWith('http');
                      const isAdmin = link.href === '/admin/analytics';

                      return (
                        <a
                          key={link.href}
                          href={link.href}
                          target={isExternal ? '_blank' : undefined}
                          rel={isExternal ? 'noreferrer' : undefined}
                          className={`inline-flex min-h-11 items-center justify-center rounded-xl border border-purple-200/70 bg-white/80 px-3.5 py-2.5 text-sm leading-tight font-semibold text-purple-900 transition-all duration-200 hover:bg-purple-100/70 hover:scale-[1.03] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${isAdmin ? 'col-span-2' : ''}`}
                          data-analytics-menu="true"
                          data-analytics-id={link.href}
                          data-analytics-label={link.label}
                          data-analytics-location="mobile_quick_links"
                          data-analytics-type={isAdmin ? 'admin_link' : 'mobile_quick_link'}
                        >
                          {link.label}
                        </a>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <a
                      href="#schedule-section"
                      className="inline-flex min-h-11 items-center justify-center rounded-xl border border-purple-300/70 bg-purple-100/80 px-3.5 py-2.5 text-sm leading-tight font-semibold text-purple-900 transition-all duration-200 hover:bg-purple-200/70 hover:scale-[1.03] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                      data-analytics-menu="true"
                      data-analytics-id="#schedule-section"
                      data-analytics-label="방송 일정 보기"
                      data-analytics-location="mobile_quick_links"
                      data-analytics-type="schedule_anchor"
                    >
                      방송 일정 보기
                    </a>
                    <a
                      href="https://cafe.naver.com/moinge"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-11 items-center justify-center rounded-xl border border-purple-300/70 bg-purple-100/80 px-3.5 py-2.5 text-sm leading-tight font-semibold text-purple-900 transition-all duration-200 hover:bg-purple-200/70 hover:scale-[1.03] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                      data-analytics-menu="true"
                      data-analytics-id="https://cafe.naver.com/moinge"
                      data-analytics-label="팬카페 바로가기"
                      data-analytics-location="mobile_quick_links"
                      data-analytics-type="community_link"
                    >
                      팬카페 바로가기
                    </a>

                  </div>
                </SectionCard>
              </ScrollReveal>

              <ScrollReveal>
                <SectionTracker sectionId="featured-videos">
                  <FeaturedVideoSection />
                </SectionTracker>
              </ScrollReveal>
              <ScrollReveal>
                <SectionTracker sectionId="clips-section">
                  <ClipsSection />
                </SectionTracker>
              </ScrollReveal>
              <ScrollReveal>
                <SectionTracker sectionId="schedule-section">
                  <ScheduleSection />
                </SectionTracker>
              </ScrollReveal>
              <ScrollReveal>
                <SectionTracker sectionId="youtube-hub">
                  <YouTubeHubSection />
                </SectionTracker>
              </ScrollReveal>
              {fanArtImages.length > 0 && (
                <ScrollReveal>
                  <SectionCard
                    tone="lavender"
                    className="lg:hidden"
                    eyebrow="Fan Art"
                    title="마녀의 작업실"
                    description="팬들의 참여로 꾸며지는 갤러리입니다."
                  >
                    <FanArtGallery images={fanArtImages} />
                  </SectionCard>
                </ScrollReveal>
              )}

              <ScrollReveal>
                <SectionCard
                  tone="neutral"
                  eyebrow="FAQ"
                  title="모잉 팬페이지 자주 묻는 질문"
                  description="방송 일정, 유튜브 최신 영상/다시보기, 숏폼 하이라이트 정보를 빠르게 확인하세요."
                >
                  <div className="space-y-3">
                    {SEO_FAQ.map((item) => (
                      <article key={item.q} className="rounded-xl border border-purple-200/60 bg-white/70 p-4">
                        <h3 className="text-sm font-semibold text-purple-950">Q. {item.q}</h3>
                        <p className="mt-1 text-sm text-purple-900/80">A. {item.a}</p>
                      </article>
                    ))}
                  </div>
                </SectionCard>
              </ScrollReveal>
            </div>
          </div>
          {/* Right Aside */}
          <RightSidebar className="hidden lg:flex lg:sticky lg:top-24" />
        </div>
      </div>
    </main>
  )
}
