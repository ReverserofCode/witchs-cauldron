"use client";

import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from "react";

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
  const [isViewerFocused, setIsViewerFocused] = useState(false);

  const safeCurrentIndex = clips.length > 0 ? Math.min(currentIndex, clips.length - 1) : 0;
  const currentClip = clips[safeCurrentIndex];
  const allFailed = clips.length > 0 && clips.every((clip) => failedClipIds.has(clip.id));

  useEffect(() => {
    if (currentIndex !== safeCurrentIndex) setCurrentIndex(safeCurrentIndex);
  }, [currentIndex, safeCurrentIndex]);

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
    setIsPlaying(false);
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

  const handleViewerKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
      return;
    }

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
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              setFailedClipIds(new Set());
              setCurrentIndex(0);
            }}
            className="inline-flex items-center justify-center rounded-lg bg-purple-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-purple-700"
          >
            다시 시도
          </button>
          <a
            href="https://chzzk.naver.com/1d333ff175b4db5bd06f87a88579ec1e"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-lg border border-purple-300 px-3 py-2 text-xs font-semibold text-purple-700 transition hover:bg-purple-50"
          >
            채널에서 보기
          </a>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleViewerKeyDown}
      onFocus={() => setIsViewerFocused(true)}
      onBlur={() => setIsViewerFocused(false)}
      aria-label="클립 뷰어"
      className="relative flex flex-col items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white rounded-2xl"
    >
      {/* Shortform Video Player */}
      <div className="relative mx-auto w-full max-w-[min(84vw,300px)]">
        {/* 비디오 컨테이너 - 9:16 비율 */}
        <div
          className="relative aspect-[9/16] w-full overflow-hidden rounded-[20px] bg-black shadow-lg shadow-purple-900/20 cursor-pointer"
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
            preload="none"
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
          <div className="absolute top-3 right-3 rounded-full bg-black/45 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
            {safeCurrentIndex + 1} / {clips.length}
          </div>

          {/* 재생/일시정지 오버레이 */}
          {!isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 shadow-lg">
                <svg className="ml-1 h-7 w-7 text-black" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          )}

          {/* 하단 정보 영역 */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3.5">
            <h3 className="text-sm font-semibold text-white mb-1 line-clamp-2">
              {currentClip.title}
            </h3>
            <p className="text-xs text-white/70">
              하이라이트 클립
            </p>
          </div>

          {/* 사이드 컨트롤 버튼들 */}
          <div className="absolute bottom-[4.5rem] right-3 flex flex-col gap-3">
            {/* 뮤트 토글 */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsMuted((prev) => !prev);
              }}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm transition-all duration-200 hover:scale-105 hover:bg-black/70 active:scale-95"
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

      </div>

      <div className="mt-4 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={goToPrev}
          disabled={isTransitioning}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-purple-600 shadow-md transition-all duration-200 hover:scale-105 hover:bg-purple-700 active:scale-95 disabled:opacity-50"
          aria-label="이전 클립"
        >
          <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z" />
          </svg>
        </button>

        <span className="min-w-16 text-center text-sm font-bold tabular-nums text-purple-800" aria-live="polite">
          {safeCurrentIndex + 1} / {clips.length}
        </span>

        <button
          type="button"
          onClick={goToNext}
          disabled={isTransitioning}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-purple-600 shadow-md transition-all duration-200 hover:scale-105 hover:bg-purple-700 active:scale-95 disabled:opacity-50"
          aria-label="다음 클립"
        >
          <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
          </svg>
        </button>
      </div>

      <p className="sr-only" aria-live="polite">
        {isViewerFocused ? "뷰어 포커스됨: ↑↓ 탐색 · Space 재생/일시정지 · M 음소거" : "클릭으로 포커스 후 ↑↓ 키 탐색 · Space 재생/일시정지 · M 음소거"}
      </p>
    </div>
  );
}
