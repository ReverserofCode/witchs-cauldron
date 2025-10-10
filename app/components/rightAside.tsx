"use client"

// 좌측 사이드바: 네비게이션 없는 배너 표시 전용
import Image from 'next/image'
import { type ReactElement, useMemo } from 'react'
import SectionCard from './sectionCard'

interface FanArtImage {
    src: string
    alt: string
    download?: string
    credit?: string
}

interface LeftAsideProps {
    className?: string
    images?: FanArtImage[]
}

const defaultImages: FanArtImage[] = [
    // {
    //     src: '/leftAside/leftSide.png',
    //     download: '/leftAside/leftSide.png',
    //     alt: '마녀의 작업실 벽지 - 마법진 조명',
    //     credit: 'Illust by 팬아트 크리에이터',
    // },
    // {
    //     src: '/mainPage/SDCharacter.png',
    //     download: '/mainPage/SDCharacter.png',
    //     alt: 'SD 캐릭터 일러스트',
    //     credit: 'Illust by Moing Studio',
    // },
    // {
    //     src: '/mainPage/Profile.png',
    //     download: '/mainPage/Profile.png',
    //     alt: '프로필 일러스트',
    // },
]

export default function LeftAside({ className, images }: LeftAsideProps = {}): ReactElement {
    const gallery = useMemo(() => (images && images.length > 0 ? images : defaultImages), [images])

    if (gallery.length === 0) {
        return (
            <aside
                className={[
                    'flex h-full w-full max-w-[200px] flex-col gap-4 rounded-3xl border border-white/15 bg-white/10 p-4 shadow-lg shadow-purple-950/20 backdrop-blur-lg lg:max-w-[220px] xl:max-w-[240px]',
                    className,
                ].filter(Boolean).join(' ')}
            >
                <SectionCard
                    tone="lavender"
                    className="h-full shadow-md rounded-2xl border-white/40 bg-white/60 shadow-purple-900/10"
                    eyebrow="Fan Art"
                    title="마녀의 작업실"
                >
                    <p className="text-xs text-purple-900/70">아직 등록된 팬아트가 없습니다.</p>
                </SectionCard>
            </aside>
        )
    }

    return (
        <aside
            className={[
                'flex h-full w-full max-w-[200px] flex-col gap-4 rounded-3xl border border-white/15 bg-white/10 p-4 shadow-lg shadow-purple-950/20 backdrop-blur-lg lg:max-w-[220px] xl:max-w-[240px]',
                className,
            ].filter(Boolean).join(' ')}
        >
            <SectionCard
                tone="lavender"
                className="h-full shadow-md rounded-2xl border-white/40 bg-white/60 shadow-purple-900/10"
                bodyClassName="gap-5"
                eyebrow="Fan Art"
                title="마녀의 작업실"
                description="팬 아트 갤러리를 감상하고 다운로드해 보세요."
            >
                <div className="flex flex-col gap-6">
                    {gallery.map((item, index) => (
                        <figure key={item.src} className="flex flex-col gap-3">
                            <div className="relative overflow-hidden border shadow-lg rounded-2xl border-white/40 shadow-purple-900/20">
                                <Image
                                    src={item.src}
                                    alt={item.alt}
                                    width={320}
                                    height={420}
                                    className="object-cover w-full h-full"
                                    sizes="(min-width: 1280px) 240px, (min-width: 1024px) 200px, 100vw"
                                    priority={index === 0}
                                />
                            </div>
                            {item.credit && (
                                <figcaption className="text-[11px] text-purple-900/70">
                                    {item.credit}
                                </figcaption>
                            )}
                            <div className="flex items-center justify-between text-[11px] text-purple-900/60">
                                <span>{index + 1} / {gallery.length}</span>
                                {item.download && (
                                    <a
                                        href={item.download}
                                        download
                                        className="btn btn-primary h-8 min-w-[5rem] justify-center text-xs"
                                    >
                                        다운로드
                                    </a>
                                )}
                            </div>
                        </figure>
                    ))}
                </div>
            </SectionCard>
        </aside>
    )
}
