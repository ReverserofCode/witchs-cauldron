"use client";

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
  const [isMuted, setIsMuted] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchShorts() {
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
  }, []);

  const currentShort = shorts[currentIndex];

  const goToNext = useCallback(() => {
    if (isTransitioning || shorts.length <= 1) return;
    setIsTransitioning(true);
    setCurrentIndex((prev) => (prev + 1) % shorts.length);
    setTimeout(() => setIsTransitioning(false), 300);
  }, [shorts.length, isTransitioning]);

  const goToPrev = useCallback(() => {
    if (isTransitioning || shorts.length <= 1) return;
    setIsTransitioning(true);
    setCurrentIndex((prev) => (prev - 1 + shorts.length) % shorts.length);
    setTimeout(() => setIsTransitioning(false), 300);
  }, [shorts.length, isTransitioning]);

  // 휠 스크롤 네비게이션
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let lastScrollTime = 0;
    const scrollThreshold = 500;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const now = Date.now();
      if (now - lastScrollTime < scrollThreshold) return;
      lastScrollTime = now;

      if (e.deltaY > 0) {
        goToNext();
      } else if (e.deltaY < 0) {
        goToPrev();
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [goToNext, goToPrev]);

  // 터치 스와이프
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let touchStartY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const touchEndY = e.changedTouches[0].clientY;
      const diff = touchStartY - touchEndY;

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

  if (error || shorts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-100">
          <svg className="w-8 h-8 text-red-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
          </svg>
        </div>
        <div>
          <h3 className="font-semibold text-red-900">Shorts가 없습니다</h3>
          <p className="text-sm text-red-700/80">
            {error || "공식 채널에서 Shorts를 불러올 수 없습니다."}
          </p>
        </div>
      </div>
    );
  }

  // YouTube embed URL with autoplay
  const embedUrl = `https://www.youtube.com/embed/${currentShort.videoId}?autoplay=1&mute=${isMuted ? 1 : 0}&loop=1&playlist=${currentShort.videoId}&playsinline=1&rel=0&modestbranding=1&controls=0`;

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col items-center"
    >
      {/* Shortform Video Player */}
      <div className="relative w-full max-w-[280px] mx-auto">
        {/* 비디오 컨테이너 - 9:16 비율 */}
        <div className="relative aspect-[9/16] w-full rounded-2xl overflow-hidden bg-black shadow-xl shadow-red-900/20">
          {/* YouTube iframe */}
          <iframe
            key={currentShort.videoId}
            src={embedUrl}
            className={`absolute inset-0 w-full h-full transition-opacity duration-300 ${
              isTransitioning ? "opacity-0" : "opacity-100"
            }`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ border: 0 }}
          />

          {/* YouTube 로고 */}
          <div className="absolute top-3 left-3 z-10 pointer-events-none">
            <div className="flex items-center gap-1.5 px-2 py-1 bg-red-600 rounded-md">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
              <span className="text-xs font-bold text-white">Shorts</span>
            </div>
          </div>

          {/* 인덱스 표시 */}
          <div className="absolute top-3 right-3 z-10 px-2 py-1 text-xs font-medium text-white bg-black/50 rounded-full backdrop-blur-sm pointer-events-none">
            {currentIndex + 1} / {shorts.length}
          </div>

          {/* 사이드 컨트롤 */}
          <div className="absolute right-3 bottom-20 z-10 flex flex-col gap-4">
            {/* 뮤트 토글 */}
            <button
              onClick={() => setIsMuted((prev) => !prev)}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm hover:bg-black/70 transition-colors"
              aria-label={isMuted ? "음소거 해제" : "음소거"}
            >
              {isMuted ? (
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
              )}
            </button>

            {/* YouTube에서 열기 */}
            <a
              href={currentShort.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm hover:bg-black/70 transition-colors"
              aria-label="YouTube에서 보기"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>

          {/* 하단 정보 (그라데이션 배경) */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none z-10">
            <h3 className="text-sm font-semibold text-white mb-1 line-clamp-2">
              {currentShort.title}
            </h3>
            <p className="text-xs text-white/70">
              {currentShort.channelTitle}
            </p>
          </div>
        </div>

        {/* 네비게이션 버튼 */}
        <div className="absolute left-1/2 -translate-x-1/2 -top-3 z-10">
          <button
            onClick={goToPrev}
            disabled={isTransitioning}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors shadow-lg"
            aria-label="이전 Shorts"
          >
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z" />
            </svg>
          </button>
        </div>
        <div className="absolute left-1/2 -translate-x-1/2 -bottom-3 z-10">
          <button
            onClick={goToNext}
            disabled={isTransitioning}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors shadow-lg"
            aria-label="다음 Shorts"
          >
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
            </svg>
          </button>
        </div>
      </div>

      {/* 인디케이터 */}
      <div className="flex justify-center gap-1.5 mt-6">
        {shorts.map((_, index) => (
          <button
            key={index}
            onClick={() => {
              if (!isTransitioning) {
                setIsTransitioning(true);
                setCurrentIndex(index);
                setTimeout(() => setIsTransitioning(false), 300);
              }
            }}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              index === currentIndex
                ? "bg-red-600 w-6"
                : "bg-red-300 hover:bg-red-400"
            }`}
            aria-label={`Shorts ${index + 1}로 이동`}
          />
        ))}
      </div>

      {/* 힌트 */}
      <p className="mt-4 text-xs text-red-500/70 text-center">
        스와이프로 탐색 · 클릭하여 YouTube에서 보기
      </p>
    </div>
  );
}
