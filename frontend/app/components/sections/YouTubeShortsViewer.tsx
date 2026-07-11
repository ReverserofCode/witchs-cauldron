"use client";

import Image from "next/image";
import { useState, useEffect, useCallback, useRef } from "react";

interface YouTubeShort {
  videoId: string;
  title: string;
  publishedAt: string;
  thumbnail: string;
  channelTitle: string;
  url: string;
}

export default function YouTubeShortsViewer() {
  const [shorts, setShorts] = useState<YouTubeShort[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isEmbedActive, setIsEmbedActive] = useState(false);
  const [retrySeed, setRetrySeed] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const retryFetch = useCallback(() => {
    setRetrySeed((prev) => prev + 1);
  }, []);

  useEffect(() => {
    async function fetchShorts() {
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/youtubeShorts/official");
        if (!res.ok) {
          throw new Error("Shorts를 불러올 수 없습니다.");
        }
        const data = await res.json();
        // 최신순 정렬 (publishedAt 기준)
        const sorted = [...data].sort((a: YouTubeShort, b: YouTubeShort) =>
          new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
        );
        setShorts(sorted);
      } catch (err) {
        setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
      } finally {
        setIsLoading(false);
      }
    }

    fetchShorts();
  }, [retrySeed]);

  const currentShort = shorts[currentIndex];

  const goToNext = useCallback(() => {
    if (isTransitioning || shorts.length <= 1) return;
    setIsTransitioning(true);
    setIsEmbedActive(false);
    setCurrentIndex((prev) => (prev + 1) % shorts.length);
    setTimeout(() => setIsTransitioning(false), 300);
  }, [shorts.length, isTransitioning]);

  const goToPrev = useCallback(() => {
    if (isTransitioning || shorts.length <= 1) return;
    setIsTransitioning(true);
    setIsEmbedActive(false);
    setCurrentIndex((prev) => (prev - 1 + shorts.length) % shorts.length);
    setTimeout(() => setIsTransitioning(false), 300);
  }, [shorts.length, isTransitioning]);

  // Horizontal swipe navigation keeps vertical page scrolling available.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let touchStartX = 0;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.touches[0].clientX;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const diff = touchStartX - e.changedTouches[0].clientX;

      if (Math.abs(diff) > 50) {
        if (diff > 0) {
          goToNext();
        } else {
          goToPrev();
        }
      }
    };

    container.addEventListener("touchstart", handleTouchStart);
    container.addEventListener("touchend", handleTouchEnd);
    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [goToNext, goToPrev]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-12 h-12 border-4 border-red-200 border-t-red-500 rounded-full animate-spin" />
        <p className="mt-4 text-sm text-gray-500">Shorts 불러오는 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-100">
          <svg className="w-8 h-8 text-red-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
          </svg>
        </div>
        <div>
          <h3 className="font-semibold text-red-900">Shorts를 불러오지 못했습니다</h3>
          <p className="text-sm text-red-700/80">
            {error || "공식 채널에서 Shorts를 불러올 수 없습니다."}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={retryFetch}
            className="inline-flex items-center justify-center rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700"
          >
            다시 시도
          </button>
          <a
            href="https://www.youtube.com/@moing/shorts"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-lg border border-red-300 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-50"
          >
            채널에서 열기
          </a>
        </div>
      </div>
    );
  }

  if (shorts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-100">
          <svg className="w-8 h-8 text-red-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
          </svg>
        </div>
        <div>
          <h3 className="font-semibold text-red-900">표시할 Shorts가 없습니다</h3>
          <p className="text-sm text-red-700/80">
            현재는 Shorts 데이터를 제공할 수 없습니다.
          </p>
        </div>
        <a
          href="https://www.youtube.com/@moing/shorts"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center rounded-lg border border-red-300 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-50"
        >
          채널에서 열기
        </a>
      </div>
    );
  }

  const embedUrl = `https://www.youtube.com/embed/${currentShort.videoId}?autoplay=1&mute=1&loop=1&playlist=${currentShort.videoId}&playsinline=1&rel=0&modestbranding=1&controls=1`;

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col items-center"
    >
      {/* Shortform Video Player */}
      <div className="relative mx-auto w-full max-w-[min(84vw,300px)]">
        {/* 비디오 컨테이너 - 9:16 비율 */}
        <div className="relative aspect-[9/16] w-full overflow-hidden rounded-[20px] bg-black shadow-lg shadow-red-900/15">
          {isEmbedActive ? (
            <iframe
              key={currentShort.videoId}
              src={embedUrl}
              title={`${currentShort.title} YouTube Shorts`}
              className={`absolute inset-0 h-full w-full transition-opacity duration-300 ${
                isTransitioning ? "opacity-0" : "opacity-100"
              }`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              style={{ border: 0 }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setIsEmbedActive(true)}
              className="absolute inset-0 h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
              aria-label={`${currentShort.title} 재생`}
            >
              <Image
                src={currentShort.thumbnail}
                alt=""
                fill
                sizes="(min-width: 1024px) 300px, min(84vw, 300px)"
                className="object-cover"
              />
              <span className="absolute inset-0 bg-black/20 transition hover:bg-black/30" aria-hidden="true" />
              <span className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/92 shadow-lg" aria-hidden="true">
                <svg className="ml-1 h-7 w-7 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
            </button>
          )}

          {/* YouTube 로고 */}
          <div className="pointer-events-none absolute top-3 left-3 z-10">
            <div className="flex items-center gap-1.5 rounded-md bg-red-600 px-2 py-1">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
              <span className="text-xs font-bold text-white">Shorts</span>
            </div>
          </div>

          {/* 인덱스 표시 */}
          <div className="pointer-events-none absolute top-3 right-3 z-10 rounded-full bg-black/50 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
            {currentIndex + 1} / {shorts.length}
          </div>

          {/* 사이드 컨트롤 */}
          <div className="absolute bottom-[4.5rem] right-3 z-10 flex flex-col gap-3">
            <a
              href={currentShort.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm transition-all duration-200 hover:scale-105 hover:bg-black/70 active:scale-95"
              aria-label="YouTube에서 보기"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>

          {/* 하단 정보 (그라데이션 배경) */}
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3.5">
            <h3 className="text-sm font-semibold text-white mb-1 line-clamp-2">
              {currentShort.title}
            </h3>
            <p className="text-xs text-white/70">
              {currentShort.channelTitle}
            </p>
          </div>
        </div>

      </div>

      <div className="mt-4 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={goToPrev}
          disabled={isTransitioning}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-red-600 shadow-md transition-all duration-200 hover:scale-105 hover:bg-red-700 active:scale-95 disabled:opacity-50"
          aria-label="이전 Shorts"
        >
          <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z" />
          </svg>
        </button>

        <span className="min-w-16 text-center text-sm font-bold tabular-nums text-red-700" aria-live="polite">
          {currentIndex + 1} / {shorts.length}
        </span>

        <button
          type="button"
          onClick={goToNext}
          disabled={isTransitioning}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-red-600 shadow-md transition-all duration-200 hover:scale-105 hover:bg-red-700 active:scale-95 disabled:opacity-50"
          aria-label="다음 Shorts"
        >
          <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
          </svg>
        </button>
      </div>

    </div>
  );
}
