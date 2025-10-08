"use client"

// 우측 사이드바: 추가 정보나 배너 영역
import Image from 'next/image'
import { useCallback, type ReactElement, type WheelEvent as ReactWheelEvent } from 'react'
import { useWheelResponsiveOffset } from './wheelResponsiveBanner'

interface RigthAsideProps {
    className?: string
}

export default function RigthAside({ className }: RigthAsideProps = {}): ReactElement {
    const { offset, applyWheelDelta } = useWheelResponsiveOffset()

    const handleWheel = useCallback(
        (event: ReactWheelEvent<HTMLElement>) => {
            applyWheelDelta(event.deltaY)
        },
        [applyWheelDelta]
    )

    return (
        <aside
            className={`h-full w-full min-h-[24rem] overflow-hidden rounded-3xl bg-[#7B68EE] ${className ?? ''}`}
            onWheel={handleWheel}
        >
            <Image
                src="/mainPage/leftSide.png"
                alt="Live Stream Banner"
                width={256}
                height={384}
                sizes="256px"
                priority
                className="block h-auto w-full transform-gpu transition-transform duration-200 ease-out"
                style={{ transform: `translateY(${offset}px)` }}
            />
        </aside>
    )
}
