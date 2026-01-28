"use client";

import Image from "next/image";
import { useCallback, useEffect, useState, type ReactElement } from "react";
import { createPortal } from "react-dom";

export interface FanArtImage {
  src: string;
  alt: string;
  download?: string;
  credit?: string;
}

interface FanArtModalProps {
  images: FanArtImage[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export default function FanArtModal({
  images,
  currentIndex,
  isOpen,
  onClose,
  onNavigate,
}: FanArtModalProps): ReactElement | null {
  const [mounted, setMounted] = useState(false);
  const currentImage = images[currentIndex];
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < images.length - 1;

  const handlePrev = useCallback(() => {
    if (hasPrev) {
      onNavigate(currentIndex - 1);
    }
  }, [currentIndex, hasPrev, onNavigate]);

  const handleNext = useCallback(() => {
    if (hasNext) {
      onNavigate(currentIndex + 1);
    }
  }, [currentIndex, hasNext, onNavigate]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft") {
        handlePrev();
      } else if (e.key === "ArrowRight") {
        handleNext();
      }
    },
    [onClose, handlePrev, handleNext]
  );

  // Ensure component is mounted before using portal (SSR safety)
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  if (!mounted || !isOpen || !currentImage) {
    return null;
  }

  // Use portal to render modal at document.body level
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="팬아트 상세 보기"
    >
      {/* Modal Content */}
      <div
        className="relative flex flex-col max-w-4xl max-h-[90vh] w-full bg-white/95 rounded-3xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-purple-100">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
              Fan Art
            </span>
            <span className="text-sm text-purple-700/80">
              {currentIndex + 1} / {images.length}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center w-10 h-10 transition-colors rounded-full hover:bg-purple-100"
            aria-label="닫기"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-purple-700"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Image Container */}
        <div className="relative flex items-center justify-center flex-1 p-6 bg-gradient-to-b from-purple-50/50 to-white">
          <div className="relative w-full h-[50vh] min-h-[300px]">
            <Image
              src={currentImage.src}
              alt={currentImage.alt}
              fill
              className="object-contain"
              sizes="(max-width: 768px) 100vw, 800px"
              priority
            />
          </div>

          {/* Navigation Arrows */}
          {hasPrev && (
            <button
              type="button"
              onClick={handlePrev}
              className="absolute flex items-center justify-center w-12 h-12 transition-all -translate-y-1/2 bg-white/90 rounded-full shadow-lg left-4 top-1/2 hover:bg-white hover:scale-110"
              aria-label="이전 이미지"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-purple-700"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          )}
          {hasNext && (
            <button
              type="button"
              onClick={handleNext}
              className="absolute flex items-center justify-center w-12 h-12 transition-all -translate-y-1/2 bg-white/90 rounded-full shadow-lg right-4 top-1/2 hover:bg-white hover:scale-110"
              aria-label="다음 이미지"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-purple-700"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-purple-100">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-purple-900">{currentImage.alt}</p>
            {currentImage.credit && (
              <p className="text-xs text-purple-600">{currentImage.credit}</p>
            )}
          </div>
          {currentImage.download && (
            <a
              href={currentImage.download}
              download
              className="px-4 py-2 text-sm font-semibold text-white transition-colors rounded-xl bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900"
            >
              다운로드
            </a>
          )}
        </div>

        {/* Thumbnail Strip */}
        {images.length > 1 && (
          <div className="px-6 py-5 border-t border-purple-100 bg-purple-50/50">
            <div className="flex gap-3 overflow-x-auto pb-2">
              {images.map((image, index) => (
                <button
                  key={image.src}
                  type="button"
                  onClick={() => onNavigate(index)}
                  className={`relative flex-shrink-0 w-24 h-24 overflow-hidden rounded-xl transition-all ${
                    index === currentIndex
                      ? "ring-2 ring-purple-600 ring-offset-2"
                      : "opacity-60 hover:opacity-100"
                  }`}
                  aria-label={`${index + 1}번 이미지로 이동`}
                  aria-current={index === currentIndex ? "true" : undefined}
                >
                  <Image
                    src={image.src}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="96px"
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
