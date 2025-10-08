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
            className={`flex h-full min-h-[24rem] items-center justify-center ${className ?? ''}`}
            bodyClassName="items-center justify-center gap-0"
            header={null}
        >
            <Image
                src="/leftAside/leftSide.png"
                alt="라이브 방송 배너"
                width={256}
                height={384}
                priority
                sizes="(min-width: 1024px) 240px, 80vw"
                className="h-auto w-full max-w-none"
            />
        </SectionCard>
    )
}
