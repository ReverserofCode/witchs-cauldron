"use client";

import Image from "next/image";
import { useEffect, useState, type ReactElement } from "react";
import { FanArtModal, type FanArtImage } from "@/app/components/modals";

interface FanArtGalleryProps {
  images: FanArtImage[];
  compact?: boolean;
}

export default function FanArtGallery({ images, compact = false }: FanArtGalleryProps): ReactElement {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlay, setIsAutoPlay] = useState(true);
  const [isInteracting, setIsInteracting] = useState(false);

  useEffect(() => {
    if (images.length <= 1 || isModalOpen || !isAutoPlay || isInteracting) return;
    const timer = window.setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 4000);

    return () => window.clearInterval(timer);
  }, [images.length, isModalOpen, isAutoPlay, isInteracting]);

  const handleImageClick = (index: number) => {
    setCurrentIndex(index);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleNavigate = (index: number) => {
    setCurrentIndex(index);
  };

  if (images.length === 0) {
    return (
      <div className="flex flex-col gap-3 text-[11px] text-purple-900/75">
        <p>아직 등록된 팬아트가 없습니다. 팬카페에 작품을 공유하면 이곳에 소개됩니다.</p>
        <a
          href="https://cafe.naver.com/moinge"
          target="_blank"
          rel="noopener noreferrer"
          className="justify-center text-xs btn btn-primary h-9"
        >
          팬아트 업로드 가이드 보기
        </a>
      </div>
    );
  }

  return (
    <>
      <div className="flex h-full min-h-0 flex-col gap-2.5">
        <figure
          className="flex h-full min-h-0 flex-col gap-2 justify-between"
          onMouseEnter={() => setIsInteracting(true)}
          onMouseLeave={() => setIsInteracting(false)}
          onFocusCapture={() => setIsInteracting(true)}
          onBlurCapture={() => setIsInteracting(false)}
        >
          <button
            type="button"
            onClick={() => handleImageClick(currentIndex)}
            className={`relative w-full overflow-hidden transition-transform border shadow-lg cursor-pointer rounded-2xl border-white/40 shadow-purple-900/20 hover:scale-[1.01] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
              compact ? "mx-auto h-[20rem] shrink-0 xl:h-[27rem]" : "aspect-[4/5] md:aspect-[4/4.8]"
            }`}
            aria-label={`${images[currentIndex].alt} 크게 보기`}
          >
            <Image
              src={images[currentIndex].src}
              alt={images[currentIndex].alt}
              width={320}
              height={420}
              className="h-full w-full object-contain bg-white/30"
              sizes={compact ? "(min-width: 1280px) 280px, 100vw" : "(min-width: 1280px) 240px, (min-width: 1024px) 200px, 100vw"}
              priority={!compact}
            />
            <div className="absolute inset-0 flex items-center justify-center transition-opacity opacity-0 bg-black/30 hover:opacity-100">
              <span className="px-3 py-1.5 text-xs font-medium text-white bg-white/20 rounded-full backdrop-blur-sm">
                크게 보기
              </span>
            </div>
          </button>

          {images[currentIndex].credit && (
            <figcaption className="text-[11px] text-purple-900/70">{images[currentIndex].credit}</figcaption>
          )}

          <div className="flex items-center justify-between text-[11px] text-purple-900/60">
            <button
              type="button"
              className="btn h-7 min-w-[4.5rem] justify-center text-[11px]"
              onClick={() => setIsAutoPlay((prev) => !prev)}
              aria-label={isAutoPlay ? "자동 회전 일시정지" : "자동 회전 재개"}
            >
              {isAutoPlay ? "자동회전 ON" : "자동회전 OFF"}
            </button>

            {images[currentIndex].download && (
              <a
                href={images[currentIndex].download}
                download
                className="btn btn-primary h-7 min-w-[4.5rem] justify-center text-[11px]"
              >
                다운로드
              </a>
            )}
          </div>
        </figure>
      </div>

      <FanArtModal
        images={images}
        currentIndex={currentIndex}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onNavigate={handleNavigate}
      />
    </>
  );
}
