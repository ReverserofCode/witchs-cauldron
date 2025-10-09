// Home page (App Router)
// - 메인 레이아웃: 3열 Grid (LeftAside | Content | RightAside)
// - HERO 섹션: 텍스트 2컬럼 + 아바타 1컬럼
// - ABOUT 섹션: 브랜드 컬러 카드
import Image from 'next/image'
import { ReactElement } from 'react'
import profileImg from '../public/mainPage/Profile.png'
import LeftAside from './components/leftAside'
import RigthAside from './components/rightAside'
import ScheduleSection from './components/scheduleSection'
import SectionCard from './components/sectionCard'
import TodayBroadcastStatusCard from './components/todayBroadcastStatusCard'
import YouTubeShortsSection from './components/YouTubeShortsSection'
import YouTubeVideosSection from './components/YouTubeVideosSection'

export default function Page(): ReactElement {
  const profileStats = [
    { title: 'Name', value: 'MOING' },
    { title: 'Height', value: '155' },
    { title: 'Age', value: '99' },
    { title: 'Weight', value: '44' },
    { title: 'MBTI', value: 'INFP' },
    { title: 'Birth', value: '3/14' },
  ] as const

  return (
    <main className="py-10 lg:py-16">
      <div className="w-full px-4 mx-auto max-w-7xl sm:px-6 lg:px-8">
        <div className="grid w-full grid-cols-1 gap-4 lg:grid-cols-[minmax(180px,0.7fr)_minmax(0,2.6fr)_minmax(180px,0.7fr)] xl:grid-cols-[minmax(200px,0.8fr)_minmax(0,2.4fr)_minmax(200px,0.8fr)] xl:gap-6">
          {/* Left Aside */}
          <LeftAside className="hidden lg:flex lg:sticky lg:top-24" />
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
                      <span className="chip">KR V-tuber • Moing</span>
                      <h1 className="text-3xl font-extrabold typography-heading md:text-4xl">
                        마녀의 포션 공방
                      </h1>
                      <div className="space-y-2.5">
                        <p className="text-base font-light typography-lead max-w-prose">
                          포션을 만들면 폭발하거나, 고백하게 만드는 재앙 제조기. “진짜 감기약 맞아요?” 음... 아마도요.
                        </p>
                        <p className="text-base font-light opacity-0 typography-lead animate-fade-in animation-delay-200">
                          모잉 팬 사이트에 오신 걸 환영합니다.
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

              <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
                <SectionCard
                  tone="lavender"
                  eyebrow="Character Profile"
                  title="설정 카드"
                  bodyClassName="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
                >
                  {profileStats.map((stat) => (
                    <div
                      key={stat.title}
                      className="flex items-center justify-between px-3 py-3 border shadow-sm rounded-2xl border-white/60 bg-white/75"
                    >
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-purple-700/90">
                        {stat.title}
                      </dt>
                      <dd className="text-[11px] font-extrabold text-purple-900/90">{stat.value}</dd>
                    </div>
                  ))}
                </SectionCard>
                <TodayBroadcastStatusCard />
              </div>
            </div>

            <div className="mt-2 space-y-10">
              <ScheduleSection />
              <YouTubeVideosSection />
              {/* 적절한 쇼츠 채널이 없어 임시 폐쇄  */}
              {/* <YouTubeShortsSection /> */}
            </div>
          </div>
          {/* Right Aside */}
          <RigthAside className="hidden lg:flex lg:sticky lg:top-24" />
        </div>
      </div>
    </main>
  )
}
