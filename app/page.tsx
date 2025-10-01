import Image from 'next/image'
import { ReactElement } from 'react'

export default function Page(): ReactElement {
  return (
    <main className="container max-w-6xl px-6 py-10 mx-auto">
      {/* HERO */}
      <section className="grid items-center grid-cols-1 gap-10 md:grid-cols-2">
        <div className="space-y-4">
          <span className="chip">KR V-tuber • Moing</span>
          <h1 className="text-4xl font-extrabold leading-tight md:text-5xl">
            The witch of the potion store
          </h1>
          <p className="text-muted max-w-prose">
            보랏빛 포션과 마법이 흐르는 공간. 이 레포는 Moing 팔레트를 반영한 디자인으로, 향후 콘텐츠와 기능을 쉽게 확장할 수 있도록 구성되어 있습니다.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <a className="btn btn-primary" href="#about">바로 둘러보기</a>
            <a className="btn btn-ghost" href="#contact">문의하기</a>
          </div>
          <div className="flex flex-wrap gap-3 pt-4">
            {[
              { label: 'Dangerous' },
              { label: 'Love' },
              { label: 'Healing' },
            ].map((p) => (
              <span key={p.label} className="chip">● {p.label}</span>
            ))}
          </div>
        </div>
        <div className="md:justify-self-end">
          <div className="avatar-frame" aria-hidden>
            <div className="glow" />
            {/* 실제 이미지 사용 시 아래 주석 해제 및 경로 교체 */}
            {/* <Image src="/app/ProjectAssets/Profile.jpg" alt="Moing" fill className="object-cover" /> */}
            <div className="inner" />
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" className="grid gap-6 mt-16 md:grid-cols-3">
        <Card title="Primary" value="#9F6AF8" />
        <Card title="Accent" value="#DBCEF7" />
        <Card title="Deep" value="#5E4E75" />
      </section>
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
