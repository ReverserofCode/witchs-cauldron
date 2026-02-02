"use client";

import Image from "next/image";
import { useState, type ReactElement } from "react";
import { FanArtModal, type FanArtImage } from "@/app/components/modals";

interface FanArtGalleryProps {
  images: FanArtImage[];
}

export default function FanArtGallery({ images }: FanArtGalleryProps): ReactElement {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

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
      <div className="flex flex-col gap-6">
        {images.map((item, index) => (
          <figure key={item.src} className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => handleImageClick(index)}
              className="relative overflow-hidden transition-transform border shadow-lg cursor-pointer rounded-2xl border-white/40 shadow-purple-900/20 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
              aria-label={`${item.alt} 크게 보기`}
            >
              <Image
                src={item.src}
                alt={item.alt}
                width={320}
                height={420}
                className="object-cover w-full h-full"
                sizes="(min-width: 1280px) 240px, (min-width: 1024px) 200px, 100vw"
                priority={index === 0}
              />
              {/* Hover overlay */}
              <div className="absolute inset-0 flex items-center justify-center transition-opacity opacity-0 bg-black/30 hover:opacity-100">
                <span className="px-3 py-1.5 text-xs font-medium text-white bg-white/20 rounded-full backdrop-blur-sm">
                  크게 보기
                </span>
              </div>
            </button>
            {item.credit && (
              <figcaption className="text-[11px] text-purple-900/70">{item.credit}</figcaption>
            )}
            <div className="flex items-center justify-between text-[11px] text-purple-900/60">
              <span>
                {index + 1} / {images.length}
              </span>
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
