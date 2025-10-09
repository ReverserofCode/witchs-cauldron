"use client"

// 좌측 사이드바: 네비게이션 없는 배너 표시 전용
import Image from 'next/image'
import { type ReactElement } from 'react'
import SectionCard from './sectionCard'

interface LeftAsideProps {
    className?: string
}

export default function LeftAside({ className }: LeftAsideProps = {}): ReactElement {
    return (
        <aside
            className={[
                'flex h-full w-full max-w-[200px] flex-col gap-4 rounded-3xl border border-white/15 bg-white/10 p-4 shadow-lg shadow-purple-950/20 backdrop-blur-lg lg:max-w-[220px] xl:max-w-[240px]',
                className,
            ].filter(Boolean).join(' ')}
        >
            <SectionCard
                tone="lavender"
                className="h-full rounded-2xl border-white/40 bg-white/60 shadow-md shadow-purple-900/10"
                bodyClassName="gap-5"
                eyebrow="Fan Art"
                title="마녀의 작업실"
                description="팬 블렌드 벽지를 다운로드하고 데스크톱을 꾸며보세요."
            >
                <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-white/40 shadow-lg shadow-purple-900/20">
                    <Image
                        src="/leftAside/leftSide.png"
                        alt="마녀의 작업실 벽지"
                        fill
                        sizes="(min-width: 1280px) 240px, (min-width: 1024px) 200px, 100vw"
                        className="object-cover"
                        priority
                    />
                </div>
                <a
                    href="/mainPage/모잉 설정.webp"
                    className="btn btn-ghost w-full justify-center text-xs"
                    download
                >
                    배경화면 다운로드
                </a>
            </SectionCard>
        </aside>
    )
}
