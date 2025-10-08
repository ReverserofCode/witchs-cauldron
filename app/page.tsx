// Home page (App Router)
// - 메인 레이아웃: 3열 Grid (LeftAside | Content | RightAside)
// - HERO 섹션: 텍스트 2컬럼 + 아바타 1컬럼
// - ABOUT 섹션: 브랜드 컬러 카드
import Image from 'next/image'
import profileImg from '../public/mainPage/Profile.png'
import LeftAside from './components/leftAside'
import RigthAside from './components/rigthAside'
import { ReactElement } from 'react'

export default function Page(): ReactElement {
  return (
    // grid-cols: md 이상에서 좌/우 16rem 고정 + 중앙 유동
    <main className="grid grid-cols-1 gap-6 py-10 md:grid-cols-[16rem_minmax(0,1fr)_16rem] w-full">
      {/* Left Aside */}
      <LeftAside />
      {/* Center Content Wrapper: 중앙 컬럼에 본문을 모아 배치 */}
      <div className="container min-w-0">
        {/* HERO */}
        {/* 텍스트 2, 이미지 1 비율의 그리드 */}
        <section className="grid items-center w-full gap-10 md:grid-cols-3">
          <div className="space-y-4 md:col-span-2">
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
            <div className="flex flex-wrap gap-3 pt-2">
              <a className="btn btn-primary" href="#about">바로 둘러보기</a>
              <a className="btn btn-ghost" href="#contact">문의하기</a>
            </div>
          </div>
          {/* 아바타 프레임: Tailwind로 크기 제어 (globals.css의 고정 w/h 제거됨) */}
          <div className="md:justify-self-end">
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
          {/* 각 쇼츠 및 영상들은 5개 까지 배치할 예정 */}
          {/* 유튜브 쇼츠 API 활용, 모잉 키리누키 채널의 쇼츠를 최신 순으로 배치 */}
          <div className='youTubeShorts'>
            
          </div>
          {/* 유튜브 모잉 공식 유튜브 채널의 영상을 최신 순으로 배치 */}
          <div className='youTubeVideos'>
            
          </div>
          {/* 유튜브 다시보기 채널의 영상 제공 */}
          <div className='youTubeRe'>
            
          </div>
          {/* 치지직 다시보기 최신순으로 제공 */}
          <div className='chzzkPlayer'>
            
          </div>
        </section>
      </div>
      {/* Right Aside */}
      <RigthAside />
    </main>
  )
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="card">
      <div className="card-title">{title}</div>
      <div className="card-value">{value}</div>
    </div>
  )
}
