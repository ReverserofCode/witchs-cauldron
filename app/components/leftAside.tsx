"use client"

// 좌측 사이드바: 네비게이션 없는 배너 표시 전용
import Image from 'next/image'
import { useCallback, type ReactElement, type WheelEvent as ReactWheelEvent } from 'react'
import { useWheelResponsiveOffset } from './wheelResponsiveBanner'

interface LeftAsideProps {
    className?: string
}

export default function LeftAside({ className }: LeftAsideProps = {}): ReactElement {
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
                className="block w-full h-auto transition-transform duration-200 ease-out transform-gpu"
                style={{ transform: `translateY(${offset}px)` }}
            />
        </aside>
    )
}
