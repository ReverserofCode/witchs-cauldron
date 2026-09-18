"use client";

import Image from "next/image";
import { useEffect, useState, type ReactElement } from "react";
import { FanArtModal, type FanArtImage } from "@/app/components/modals";
import { useFanArtCatalog } from "@/app/hooks/useFanArtCatalog";
import { introductionDate, isManagedImage } from "@/app/lib/fanart/display";

interface FanArtGalleryProps {
  images: FanArtImage[];
  compact?: boolean;
}

export default function FanArtGallery({ images: legacyImages, compact = false }: FanArtGalleryProps): ReactElement {
  const images = useFanArtCatalog(legacyImages);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSrc, setSelectedSrc] = useState<string | null>(null);
  const currentIndex = Math.max(0, images.findIndex(image => image.src === selectedSrc));
  const modalVisible = isModalOpen && images.some(image => image.src === selectedSrc);
  const [isAutoPlay, setIsAutoPlay] = useState(true);
  const [isInteracting, setIsInteracting] = useState(false);

  // Reconcile the open intent as well as the visible selection when a catalog
  // update removes it. Otherwise the next autoplay tick can reopen the modal.
  if (selectedSrc !== null && !images.some(image => image.src === selectedSrc)) {
    setSelectedSrc(null);
    setIsModalOpen(false);
  }

  useEffect(() => {
    if (images.length <= 1 || modalVisible || !isAutoPlay || isInteracting) return;
    const timer = window.setInterval(() => {
      setSelectedSrc(images[(currentIndex + 1) % images.length].src);
    }, 4000);

    return () => window.clearInterval(timer);
  }, [images, currentIndex, modalVisible, isAutoPlay, isInteracting]);

  const handleImageClick = (index: number) => {
    setSelectedSrc(images[index]?.src ?? null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleNavigate = (index: number) => {
    setSelectedSrc(images[index]?.src ?? null);
  };

  if (images.length === 0) {
    return (
      <div className="flex flex-col gap-3 text-[11px] text-purple-900/75">
        <p>작가의 사용 허락과 검수를 마친 작품을 소개합니다. 아직 등록된 작품이 없습니다.</p>
        <a
          href="https://cafe.naver.com/moinge"
          target="_blank"
          rel="noopener noreferrer"
          className="justify-center text-xs btn btn-primary h-9"
        >
          팬카페 보기
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
              unoptimized={isManagedImage(images[currentIndex])}
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
          {isManagedImage(images[currentIndex]) && (
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-purple-800">
              <span>작가 확인·운영자 검수</span>
              <span>{introductionDate(images[currentIndex].publishedAt!)} 소개</span>
              <a href={images[currentIndex].sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">원문 보기</a>
            </div>
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
        isOpen={modalVisible}
        onClose={handleCloseModal}
        onNavigate={handleNavigate}
      />
    </>
  );
}
