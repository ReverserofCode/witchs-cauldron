// 좌측 사이드바: 네비게이션 없는 배너 표시 전용
import Image from 'next/image'
import type { ReactElement } from 'react'

export default function LeftAside(): ReactElement {
    return (
        <aside className="sticky self-start hidden w-64 h-full md:block top-20 bg-[#191970]">
            <div className="overflow-hidden rounded-xl ">
                <Image
                    src="/mainPage/leftSide.png"
                    alt="Live Stream Banner"
                    width={256}
                    height={384}
                    sizes="256px"
                    className="block object-cover w-full h-auto"
                    priority
                />
            </div>
        </aside>
    )
}
