"use client"

// 우측 사이드바: 추가 정보나 배너 영역
import Image from 'next/image'
import Link from 'next/link'
import { type ReactElement } from 'react'
import SectionCard from './sectionCard'

interface RightAsideProps {
    className?: string
}

export default function RightAside({ className }: RightAsideProps = {}): ReactElement {
    return (
        <aside
            className={[
                'flex h-full w-full max-w-xs flex-col gap-5 rounded-3xl border border-white/15 bg-white/10 p-5 shadow-lg shadow-purple-950/20 backdrop-blur-lg lg:max-w-[220px] xl:max-w-[240px]',
                className,
            ].filter(Boolean).join(' ')}
        >
            <SectionCard
                tone="neutral"
                className="shadow-md rounded-2xl border-white/40 bg-white/70 shadow-purple-900/10"
                bodyClassName="gap-4"
                eyebrow="Schedule"
                title="이번 주 생방송"
            >
                <ul className="space-y-3 text-xs font-medium text-purple-950/80">
                    <li className="flex items-center justify-between px-3 py-2 shadow-sm rounded-xl bg-purple-100/60">
                        <span>화 • 21:00</span>
                        <span>포션 실험 & 채팅</span>
                    </li>
                    <li className="flex items-center justify-between px-3 py-2 shadow-sm rounded-xl bg-purple-100/40">
                        <span>목 • 20:30</span>
                        <span>마녀 수업</span>
                    </li>
                    <li className="flex items-center justify-between px-3 py-2 shadow-sm rounded-xl bg-purple-100/30">
                        <span>토 • 22:00</span>
                        <span>비밀 야간방송</span>
                    </li>
                </ul>
                <Link href="#schedule-section" className="justify-center w-full text-xs btn btn-primary">
                    전체 일정 보기
                </Link>
            </SectionCard>

            <SectionCard
                tone="lavender"
                className="shadow-md rounded-2xl border-white/40 bg-gradient-to-br from-purple-100/70 via-white/70 to-white/90 shadow-purple-900/15"
                bodyClassName="gap-5"
                eyebrow="Community"
                title="모잉과 연결되기"
            >
                <div className="relative overflow-hidden border shadow-lg rounded-2xl border-white/40 bg-white/60 shadow-purple-900/15">
                    <Image
                        src="/rightAside/leftSide.png"
                        alt="모잉 커뮤니티"
                        width={320}
                        height={180}
                        className="object-cover w-full h-auto"
                        priority
                    />
                </div>
                <div className="flex flex-col gap-2 text-xs text-purple-900/80">
                    <p className="font-semibold">비밀 재료는 팬들과 함께 나눠요.</p>
                    <p className="text-purple-900/60">디스코드에 참여하고 최신 소식과 이벤트 정보를 받아보세요.</p>
                </div>
                <div className="flex flex-col gap-2">
                    <a href="https://discord.gg" target="_blank" rel="noreferrer" className="justify-center w-full text-xs btn btn-ghost">
                        디스코드 입장하기
                    </a>
                    <a href="https://twitter.com" target="_blank" rel="noreferrer" className="justify-center w-full text-xs btn btn-ghost">
                        트위터 팔로우
                    </a>
                </div>
            </SectionCard>
        </aside>
    )
}
