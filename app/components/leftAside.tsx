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
        <SectionCard
            as="aside"
            tone="dimmed"
            className={`flex h-full min-h-[24rem] flex-col overflow-hidden p-0 ${className ?? ''}`}
            bodyClassName="flex-1 h-full gap-0"
            header={null}
        >
            <div className="relative flex-1 min-h-full">
                <Image
                    src="/leftAside/leftSide.png"
                    alt="라이브 방송 배너"
                    fill
                    priority
                    sizes="(min-width: 1024px) 240px, 80vw"
                    className="object-cover w-full h-full"
                />
            </div>
        </SectionCard>
    )
}
