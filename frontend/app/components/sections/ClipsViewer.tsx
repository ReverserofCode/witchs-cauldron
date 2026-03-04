"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface Clip {
  id: string;
  src: string;
  title: string;
}

interface ClipsViewerProps {
  clips: Clip[];
}

export default function ClipsViewer({ clips }: ClipsViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [failedClipIds, setFailedClipIds] = useState<Set<string>>(new Set());
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentClip = clips[currentIndex];
  const allFailed = clips.length > 0 && failedClipIds.size >= clips.length;

  // 비디오 진행률 업데이트
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateProgress = () => {
      if (video.duration) {
        setProgress((video.currentTime / video.duration) * 100);
      }
    };

    video.addEventListener("timeupdate", updateProgress);
    return () => video.removeEventListener("timeupdate", updateProgress);
  }, [currentIndex]);

  // 비디오 설정 및 재생
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = isMuted;
    video.volume = 0.3;

    if (isPlaying) {
      video
        .play()
        .catch(() => {
          // 자동 재생 차단 또는 코덱 미지원 시 무시
        });
    } else {
      video.pause();
    }
  }, [isPlaying, isMuted, currentIndex]);

  // 클립 변경 시 초기화
  useEffect(() => {
    setProgress(0);
    setIsPlaying(true);
    const video = videoRef.current;
    if (video) {
      video.load();
    }
  }, [currentIndex]);

  const goToNext = useCallback(() => {
    if (isTransitioning || clips.length <= 1) return;
    setIsTransitioning(true);
    setCurrentIndex((prev) => (prev + 1) % clips.length);
    setTimeout(() => setIsTransitioning(false), 300);
  }, [clips.length, isTransitioning]);

  const goToPrev = useCallback(() => {
    if (isTransitioning || clips.length <= 1) return;
    setIsTransitioning(true);
    setCurrentIndex((prev) => (prev - 1 + clips.length) % clips.length);
    setTimeout(() => setIsTransitioning(false), 300);
  }, [clips.length, isTransitioning]);

  // 키보드 네비게이션
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        goToPrev();
      } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        goToNext();
      } else if (e.key === " ") {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      } else if (e.key === "m" || e.key === "M") {
        setIsMuted((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goToNext, goToPrev]);

  // 휠 스크롤로 네비게이션
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let lastScrollTime = 0;
    const scrollThreshold = 500; // 스크롤 간격 제한 (ms)

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
    let touchEndY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      touchEndY = e.changedTouches[0].clientY;
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

  const handleVideoClick = () => {
    setIsPlaying((prev) => !prev);
  };

  const handleVideoEnd = () => {
    goToNext();
  };

  const handleVideoError = () => {
    if (!currentClip) return;
    setFailedClipIds((prev) => {
      if (prev.has(currentClip.id)) return prev;
      const next = new Set(prev);
      next.add(currentClip.id);
      return next;
    });
    goToNext();
  };

  if (clips.length === 0 || allFailed) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-purple-100">
          <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <h3 className="font-semibold text-purple-900">클립을 재생할 수 없습니다</h3>
          <p className="text-sm text-purple-700/80">
            파일이 없거나 브라우저에서 지원하지 않는 형식일 수 있습니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col items-center"
    >
      {/* Shortform Video Player */}
      <div className="relative w-full max-w-[min(88vw,320px)] mx-auto">
        {/* 비디오 컨테이너 - 9:16 비율 */}
        <div
          className="relative aspect-[9/16] w-full rounded-2xl overflow-hidden bg-black shadow-xl shadow-purple-900/30 cursor-pointer"
          onClick={handleVideoClick}
        >
          {/* 비디오 */}
          <video
            ref={videoRef}
            key={currentClip.id}
            src={currentClip.src}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
              isTransitioning ? "opacity-0" : "opacity-100"
            }`}
            loop={clips.length === 1}
            muted={isMuted}
            autoPlay={isPlaying}
            playsInline
            preload="metadata"
            onEnded={handleVideoEnd}
            onError={handleVideoError}
          />

          {/* 진행 바 */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-white/20">
            <div
              className="h-full bg-white transition-all duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* 클립 인덱스 표시 */}
          <div className="absolute top-3 right-3 px-2 py-1 text-xs font-medium text-white bg-black/50 rounded-full backdrop-blur-sm">
            {currentIndex + 1} / {clips.length}
          </div>

          {/* 재생/일시정지 오버레이 */}
          {!isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-white/90 shadow-lg">
                <svg className="w-8 h-8 text-black ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          )}

          {/* 하단 정보 영역 */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
            <h3 className="text-sm font-semibold text-white mb-1 line-clamp-2">
              {currentClip.title}
            </h3>
            <p className="text-xs text-white/70">
              하이라이트 클립
            </p>
          </div>

          {/* 사이드 컨트롤 버튼들 */}
          <div className="absolute right-3 bottom-20 flex flex-col gap-4">
            {/* 뮤트 토글 */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsMuted((prev) => !prev);
              }}
              className="flex items-center justify-center w-11 h-11 rounded-full bg-black/50 backdrop-blur-sm hover:bg-black/70 hover:scale-110 active:scale-95 transition-all duration-200"
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
          </div>
        </div>

        {/* 네비게이션 버튼 */}
        <div className="absolute left-1/2 -translate-x-1/2 -top-3 z-10">
          <button
            onClick={goToPrev}
            disabled={isTransitioning}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-purple-600 hover:bg-purple-700 hover:scale-110 active:scale-95 disabled:opacity-50 transition-all duration-200 shadow-lg"
            aria-label="이전 클립"
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
            className="flex items-center justify-center w-10 h-10 rounded-full bg-purple-600 hover:bg-purple-700 hover:scale-110 active:scale-95 disabled:opacity-50 transition-all duration-200 shadow-lg"
            aria-label="다음 클립"
          >
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
            </svg>
          </button>
        </div>
      </div>

      {/* 클립 인디케이터 (세로) */}
      <div className="flex justify-center gap-1.5 mt-6">
        {clips.map((_, index) => (
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
                ? "bg-purple-600 w-6"
                : "bg-purple-300 hover:bg-purple-400"
            }`}
            aria-label={`클립 ${index + 1}로 이동`}
          />
        ))}
      </div>

      {/* 조작 힌트 */}
      <p className="mt-4 text-xs text-purple-500/70 text-center">
        스와이프 또는 ↑↓ 키로 탐색 · Space로 재생/일시정지 · M으로 음소거
      </p>
    </div>
  );
}
