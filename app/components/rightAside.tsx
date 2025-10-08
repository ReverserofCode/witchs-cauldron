"use client"

// 우측 사이드바: 추가 정보나 배너 영역
import Image from 'next/image'
import { type ReactElement } from 'react'
import SectionCard from './sectionCard'

interface RightAsideProps {
    className?: string
}

export default function RightAside({ className }: RightAsideProps = {}): ReactElement {
    return (
        <SectionCard
            as="aside"
            tone="dimmed"
            className={`flex h-full min-h-[24rem] items-center justify-center ${className ?? ''}`}
            bodyClassName="items-center justify-center gap-0"
            header={null}
        >
            <Image
                src="/rightAside/leftSide.png"
                alt="보조 정보용 배너"
                width={256}
                height={384}
                priority
                sizes="(min-width: 1024px) 240px, 80vw"
                className="h-auto w-full max-w-none"
            />
        </SectionCard>
    )
}
