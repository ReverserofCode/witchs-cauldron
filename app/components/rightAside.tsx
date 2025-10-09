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
            className={`flex h-full min-h-[24rem] flex-col overflow-hidden p-0 ${className ?? ''}`}
            bodyClassName="flex-1 h-full gap-0"
            header={null}
        >
            <div className="relative flex-1 min-h-full">
                <Image
                    src="/rightAside/leftSide.png"
                    alt="보조 정보용 배너"
                    fill
                    priority
                    sizes="(min-width: 1024px) 240px, 80vw"
                    className="h-full w-full object-cover"
                />
            </div>
        </SectionCard>
    )
}
