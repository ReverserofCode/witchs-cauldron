"use client"

// 우측 사이드바: 추가 정보나 배너 영역
import Image from 'next/image'
import { type ReactElement } from 'react'

interface RightAsideProps {
    className?: string
}

export default function RightAside({ className }: RightAsideProps = {}): ReactElement {
    return (
        <aside
            aria-label="보조 정보 배너"
            className={`flex h-full w-full min-h-[24rem] items-center justify-center overflow-hidden rounded-3xl bg-[#7B68EE] ${className ?? ''}`}
        >
            <Image
                src="/rightAside/leftSide.png"
                alt="보조 정보용 배너"
                width={256}
                height={384}
                priority
                sizes="(min-width: 1024px) 240px, 80vw"
                className="block h-auto w-full max-w-none"
            />
        </aside>
    )
}
