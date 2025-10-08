// Home page (App Router)
// - 메인 레이아웃: 3열 Grid (LeftAside | Content | RightAside)
// - HERO 섹션: 텍스트 2컬럼 + 아바타 1컬럼
// - ABOUT 섹션: 브랜드 컬러 카드
import Image from 'next/image'
import profileImg from '../public/mainPage/Profile.png'
import LeftAside from './components/leftAside'
import RigthAside from './components/rightAside'
import ScheduleSection from './components/scheduleSection'
import TodayBroadcastStatusCard from './components/todayBroadcastStatusCard'
import { ReactElement } from 'react'

export default function Page(): ReactElement {
  const profileStats = [
    { title: 'Name', value: 'MOING' },
    { title: 'Height', value: '155' },
    { title: 'Age', value: '99' },
    { title: 'Weight', value: '44' },
    { title: 'MBTI', value: 'INFP' },
    { title: 'Birthday', value: '3/14' },
  ] as const

  return (
    <main className="py-10">
      <div className="container grid w-full grid-cols-1 gap-6 lg:grid-cols-[15rem_minmax(0,1fr)_15rem] lg:items-stretch">
        {/* Left Aside */}
  <LeftAside className="hidden h-full shadow-lg shadow-black/15 lg:block" />
        {/* Center Content Wrapper: 중앙 컬럼에 본문을 모아 배치 */}
        <div className="min-w-0">
          {/* HERO */}
          {/* 텍스트 2, 이미지 1 비율의 그리드 */}
          {/* 초기 소개용 섹션 */}
          <section className="flex flex-col w-full gap-12 Intro-section">
            <div className="grid items-start gap-10 grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              <div className="space-y-4">
                <span className="chip">KR V-tuber • Moing</span>
                <h1 className="text-4xl font-extrabold leading-tight md:text-5xl">
                  마녀의 포션 공방
                </h1>
                <p className="text-xl font-light text-white transition duration-300 transform intro-text max-w-prose">
                  포션을 만들면 폭발하거나, 고백하게 만드는 재앙 제조기.<br />
                  “진짜 감기약 맞아요?” 음... 아마도요.
                  <span className="block text-lg font-light opacity-0 animate-fade-in animation-delay-200">
                    모잉 팬 사이트에 오신 걸 환영합니다.
                  </span>
                </p>
              </div>

              {/* 아바타 프레임: Tailwind로 크기 제어 (globals.css의 고정 w/h 제거됨) */}
              <div className="profile-avatar justify-self-end">
                <div className="relative avatar-frame w-36 h-36 md:w-52 md:h-52" aria-hidden>
                  <div className="glow" />
                  {/* Next.js 권장: 로컬 자산은 정적 import 사용. public 폴더가 아니라도 동작합니다. */}
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

            <div className="grid gap-6 grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
              <section
                aria-labelledby="profile-stats-title"
                className="relative p-6 overflow-hidden border shadow-xl rounded-3xl border-white/30 bg-gradient-to-br from-purple-300/40 via-purple-200/40 to-white/60"
              >
                <div className="absolute w-56 h-56 rounded-full pointer-events-none -right-20 -top-24 bg-purple-300/40 blur-3xl" />
                <div className="absolute bottom-0 w-20 h-20 rounded-full pointer-events-none left-6 bg-purple-200/50 blur-2xl" />
                <header className="relative flex flex-col gap-1 mb-6 text-left">
                  <span className="text-sm font-semibold uppercase tracking-[0.2em] text-purple-700/80">
                    Character Profile
                  </span>
                  <h2 id="profile-stats-title" className="text-2xl font-black text-purple-900/90">
                    설정 카드
                  </h2>
                </header>
                <div className="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {profileStats.map((stat) => (
                    <div
                      key={stat.title}
                      className="flex items-center justify-between px-4 py-4 border shadow-sm rounded-2xl border-white/60 bg-white/70 backdrop-blur"
                    >
                      <dt className="text-sm font-semibold tracking-wide uppercase text-purple-700/90">
                        {stat.title}
                      </dt>
                      <dd className="text-sm font-extrabold text-purple-900/90">
                        {stat.value}
                      </dd>
                    </div>
                  ))}
                </div>
              </section>
              <TodayBroadcastStatusCard />
            </div>
          </section>

          <div className="mt-16">
            <ScheduleSection />
          </div>

          {/* 각 쇼츠 및 영상들은 5개 까지 배치할 예정 */}
          {/* 유튜브 쇼츠 API 활용, 모잉 키리누키 채널의 쇼츠를 최신 순으로 배치 */}
          <div className="youTubeShorts">

          </div>
          {/* 유튜브 모잉 공식 유튜브 채널의 영상을 최신 순으로 배치 */}
          <div className="youTubeVideos">

          </div>
          {/* 유튜브 다시보기 채널의 영상 제공 */}
          <div className="youTubeRe">

          </div>
          {/* 치지직 다시보기 최신순으로 제공 */}
          <div className="chzzkPlayer">

          </div>
        </div>
        {/* Right Aside */}
  <RigthAside className="hidden h-full shadow-lg shadow-black/15 lg:block" />
      </div>
    </main>
  )
}
