// Home page (App Router)
// - 메인 레이아웃: 3열 Grid (LeftAside | Content | RightAside)
// - HERO 섹션: 텍스트 2컬럼 + 아바타 1컬럼
// - ABOUT 섹션: 브랜드 컬러 카드
import Image from 'next/image'
import { ReactElement } from 'react'
import { getChzzkLiveStatus } from './api/chzzkPlayer/chzzkPlayer'
import profileImg from '../public/mainPage/Profile.png'
import { SectionCard } from '@/app/components/cards'
import {
  ClipsSection,
  ScheduleSection,
  FeaturedVideoSection,
  LiveStatusCard,
  LiveStatusChip,
  LiveStatusDescription,
} from '@/app/components/sections'
import { SectionTracker } from '@/app/components/analytics/SectionTracker'
import { ScrollReveal } from '@/app/components/animations'
import { FanArtGallery } from '@/app/components/gallery'
import { loadFanArtImages } from '@/app/lib/fanart'
import { getBirthdayBannerCopy, isBirthdayToday } from '@/app/lib/birthday'

export const dynamic = 'force-dynamic'

const HERO_QUICK_LINKS = [
  { label: '치지직', href: 'https://chzzk.naver.com/1d333ff175b4db5bd06f87a88579ec1e' },
  { label: '유튜브', href: 'https://www.youtube.com/channel/UCHzre37UF4o64HRhp-7CDzQ' },
  { label: '다시보기', href: 'https://www.youtube.com/@fullmoing' },
  { label: '팬카페', href: 'https://cafe.naver.com/moinge' },
]

const HERO_CHANNEL_LINKS = HERO_QUICK_LINKS

const HERO_FOCUS_ITEMS = [
  {
    label: '소속',
    value: '패러블 엔터테인먼트',
    description: 'KR V-tuber',
  },
  {
    label: '활동 채널',
    value: '치지직 · 유튜브',
    description: '라이브 · 하이라이트 · 다시보기',
  },
]

const SEO_FAQ = [
  {
    q: '모잉은 어느 소속인가요?',
    a: '모잉은 패러블 엔터테인먼트 소속 버튜버입니다.',
  },
  {
    q: '모잉 방송 일정은 어디서 확인할 수 있나요?',
    a: '메인 페이지의 방송 일정 섹션에서 최근 일정과 예정 방송을 확인할 수 있습니다.',
  },
  {
    q: '모잉 유튜브 최신 영상과 다시보기는 어떻게 보나요?',
    a: '이번 주 추천 영상 섹션에서 공식 채널과 다시보기 채널의 주요 영상을 확인할 수 있습니다.',
  },
  {
    q: '모잉 하이라이트 숏폼과 클립도 볼 수 있나요?',
    a: '숏폼 하이라이트 섹션에서 YouTube Shorts와 클립을 모아서 볼 수 있습니다.',
  },
]

export default async function Page(): Promise<ReactElement> {
  const fanArtImages = loadFanArtImages()
  const showBirthdayBanner = isBirthdayToday()
  const birthdayBannerCopy = showBirthdayBanner ? getBirthdayBannerCopy() : null
  const liveStatus = await getChzzkLiveStatus()

  return (
    <main className="py-8 lg:py-12">
      <div className="w-full px-4 mx-auto max-w-6xl sm:px-6 lg:px-8">
        <div className="flex min-w-0 flex-col gap-5 text-[15px] leading-relaxed">
          <div className="flex flex-col w-full gap-5 Intro-section">
            <SectionCard
              tone="dimmed"
              bodyClassName="gap-5"
            >
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)] xl:items-start">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="chip text-xs sm:text-sm">KR V-tuber • Moing</span>
                    <span className="chip text-[11px] sm:text-xs">패러블 엔터테인먼트 소속</span>
                    <span className="inline-flex items-center rounded-md bg-white/95 px-2 py-1 shadow-sm ring-1 ring-black/10">
                      <Image
                        src="/logos/parable-ent.svg"
                        alt="패러블 엔터테인먼트 로고"
                        width={98}
                        height={16}
                        className="h-3.5 w-auto sm:h-4"
                        unoptimized
                      />
                    </span>
                    <LiveStatusChip initialStatus={liveStatus} />
                  </div>

                  <div className="space-y-3">
                    <div className="min-w-0">
                      <h1 className="mt-2 text-3xl font-black typography-heading sm:text-4xl lg:text-[2.8rem]">
                        마녀의 포션 공방
                      </h1>
                    </div>
                    <p className="max-w-2xl text-sm font-light text-purple-100/90 typography-lead sm:text-base">
                      포션을 만들면 폭발하거나, 고백하게 만드는 재앙 제조기. 모잉의 방송, 영상, 숏폼, 팬 콘텐츠를 한곳에서 모아 봅니다.
                    </p>
                    <LiveStatusDescription initialStatus={liveStatus} />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <LiveStatusCard initialStatus={liveStatus} />
                      {HERO_FOCUS_ITEMS.map((item) => (
                        <div
                          key={item.label}
                          className="liquid-glass-panel rounded-[24px] px-4 py-3"
                        >
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-purple-200/70">
                          {item.label}
                        </p>
                        <p className="mt-2 text-base font-bold text-white">{item.value}</p>
                        <p className="mt-1 text-xs text-purple-100/75">{item.description}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-purple-100/72 typography-body">
                    콘텐츠: 방송 · 숏폼 · 클립 · 팬카페 · 팬아트
                  </p>
                </div>

                <div className="grid gap-6">
                  <div className="liquid-glass-panel flex items-center gap-4 rounded-[24px] p-4">
                    <div className="profile-avatar flex-shrink-0">
                      <div className="relative h-24 w-24 sm:h-28 sm:w-28" aria-hidden>
                        <div className="h-full w-full avatar-frame">
                          <div className="glow" />
                          <Image
                            src={profileImg}
                            alt="Moing"
                            fill
                            sizes="(min-width: 768px) 112px, 96px"
                            className="object-cover"
                            priority
                          />
                        </div>
                      </div>
                    </div>
                    <div className="min-w-0 space-y-1.5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-purple-200/70">
                        프로필
                      </p>
                      <p className="text-lg font-bold text-white">모잉</p>
                      <div className="space-y-0.5 text-purple-100/80">
                        <p className="text-sm sm:whitespace-nowrap">버튜버 · 스트리머</p>
                        <p className="text-[13px] text-purple-200/85">패러블 엔터테인먼트 소속</p>
                      </div>
                    </div>
                  </div>

                  <div className="liquid-glass-panel rounded-[24px] p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-purple-200/70">
                      채널 바로가기
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {HERO_CHANNEL_LINKS.map((link) => {
                        const isExternal = link.href.startsWith('http')
                        return (
                          <a
                            key={link.href}
                            href={link.href}
                            target={isExternal ? '_blank' : undefined}
                            rel={isExternal ? 'noreferrer' : undefined}
                            className="liquid-glass-control inline-flex min-h-10 w-full items-center justify-center rounded-[16px] px-3 py-2 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5"
                            data-analytics-menu="true"
                            data-analytics-id={link.href}
                            data-analytics-label={link.label}
                            data-analytics-location="hero_quick_links"
                            data-analytics-type="quick_link"
                          >
                            {link.label}
                          </a>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>

            {showBirthdayBanner && birthdayBannerCopy && (
              <SectionCard
                tone="lavender"
                className="border-amber-200/70 bg-gradient-to-r from-amber-50/85 via-white/90 to-purple-100/75"
                eyebrow="Birthday"
                title="오늘은 특별한 날"
                description="모잉의 생일을 함께 축하해 주세요."
              >
                <div className="rounded-2xl border border-amber-200/70 bg-white/80 px-4 py-3">
                  <p className="text-base font-semibold text-amber-800">{birthdayBannerCopy}</p>
                  <p className="mt-1 text-sm text-purple-900/80">
                    팬카페와 치지직 채널에서 따뜻한 축하 메시지를 남겨보세요.
                  </p>
                </div>
              </SectionCard>
            )}

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
                <SectionCard
                  tone="lavender"
                  eyebrow="Community"
                  title="라이브 일정 · 팬아트"
                  description="최근 방송 일정과 팬 커뮤니티 작업을 함께 확인할 수 있습니다."
                >
                  <div className={`grid gap-3 ${fanArtImages.length > 0 ? 'xl:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)]' : ''}`}>
                    <div className="rounded-[20px] border border-purple-200/55 bg-white/70 p-3">
                      <ScheduleSection embedded daysToShow={5} limit={1} />
                    </div>

                    {fanArtImages.length > 0 && (
                      <div
                        id="fanart-section"
                        className="flex flex-col rounded-[20px] border border-purple-200/55 bg-white/70 p-3 xl:h-[34rem]"
                      >
                        <div className="mb-3 border-b border-purple-200/60 pb-2.5">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-purple-700/70">
                            팬아트
                          </p>
                          <p className="mt-1 text-sm font-semibold text-purple-950">
                            팬 커뮤니티 작업실
                          </p>
                        </div>
                        <div className="min-h-0 xl:flex-1">
                          <FanArtGallery images={fanArtImages} compact />
                        </div>
                      </div>
                    )}
                  </div>
                </SectionCard>
              </SectionTracker>
            </ScrollReveal>

            <ScrollReveal>
              <SectionCard
                tone="neutral"
                eyebrow="FAQ"
                title="모잉 팬페이지 자주 묻는 질문"
              >
                <div className="grid gap-3 md:grid-cols-2">
                  {SEO_FAQ.map((item) => (
                    <details
                      key={item.q}
                      className="group rounded-2xl border border-purple-200/60 bg-white/78 p-4"
                    >
                      <summary className="cursor-pointer list-none text-sm font-semibold text-purple-950">
                        <span className="flex items-start justify-between gap-3">
                          <span>Q. {item.q}</span>
                          <span className="mt-0.5 text-purple-500 transition-transform duration-200 group-open:rotate-45">
                            +
                          </span>
                        </span>
                      </summary>
                      <p className="mt-3 text-sm text-purple-900/80">A. {item.a}</p>
                    </details>
                  ))}
                </div>
              </SectionCard>
            </ScrollReveal>
          </div>
        </div>
      </div>
    </main>
  )
}
