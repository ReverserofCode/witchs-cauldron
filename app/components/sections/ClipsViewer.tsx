"use client";

import { useState, useRef, useEffect } from "react";

interface Clip {
  id: string;
  src: string;
  title: string;
}

interface ClipsViewerProps {
  clips: Clip[];
}

function ClipPlayer({ clip, isActive, onClick }: { clip: Clip; isActive: boolean; onClick: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (videoRef.current) {
      // 볼륨을 30%로 설정
      videoRef.current.volume = 0.3;
      
      if (isActive && isPlaying) {
        videoRef.current.play().catch(() => {
          // 자동 재생이 차단된 경우 무시
        });
      } else {
        videoRef.current.pause();
      }
    }
  }, [isActive, isPlaying]);

  const handleVideoClick = () => {
    if (isActive) {
      setIsPlaying(!isPlaying);
    } else {
      onClick();
    }
  };

  return (
    <div 
      className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden border border-white/20 shadow-lg shadow-purple-900/20 cursor-pointer"
      onClick={handleVideoClick}
    >
      <video
        ref={videoRef}
        src={clip.src}
        className="object-cover w-full h-full"
        loop
        playsInline
        preload="metadata"
      />
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 via-black/20 to-transparent">
        <h3 className="text-xs font-semibold text-white">{clip.title}</h3>
      </div>
      {(!isActive || !isPlaying) && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white/90">
            <svg className="w-5 h-5 text-black ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      )}
      {isActive && (
        <div className="absolute top-2 left-2">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
        </div>
      )}
    </div>
  );
}

export default function ClipsViewer({ clips }: ClipsViewerProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const clipsPerPage = 2;
  const totalPages = Math.ceil(clips.length / clipsPerPage);
  const [activeIndex, setActiveIndex] = useState(0);

  const handlePrevious = () => {
    setCurrentPage((prev) => (prev === 0 ? totalPages - 1 : prev - 1));
    setActiveIndex(0); // 페이지 변경 시 첫 번째 클립을 활성화
  };

  const handleNext = () => {
    setCurrentPage((prev) => (prev === totalPages - 1 ? 0 : prev + 1));
    setActiveIndex(0); // 페이지 변경 시 첫 번째 클립을 활성화
  };

  const getCurrentClips = () => {
    const startIndex = currentPage * clipsPerPage;
    return clips.slice(startIndex, startIndex + clipsPerPage);
  };

  const currentClips = getCurrentClips();

  if (clips.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-purple-100">
          <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <h3 className="font-semibold text-purple-900">클립이 없습니다</h3>
          <p className="text-sm text-purple-700/80">아직 등록된 클립이 없습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Clips Grid */}
      <div className="grid grid-cols-2 gap-4">
        {currentClips.map((clip, index) => (
          <ClipPlayer
            key={clip.id}
            clip={clip}
            isActive={index === activeIndex}
            onClick={() => setActiveIndex(index)}
          />
        ))}
      </div>

      {/* Navigation */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button
            onClick={handlePrevious}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-purple-700 transition-colors bg-purple-100 rounded-lg hover:bg-purple-200"
            aria-label="이전 페이지"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
            </svg>
            이전
          </button>

          {/* Page indicator */}
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              {Array.from({ length: totalPages }).map((_, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setCurrentPage(index);
                    setActiveIndex(0);
                  }}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === currentPage
                      ? "bg-purple-600"
                      : "bg-purple-300 hover:bg-purple-400"
                  }`}
                  aria-label={`페이지 ${index + 1}로 이동`}
                />
              ))}
            </div>
            <div className="text-xs font-medium text-purple-700/80">
              {currentPage + 1} / {totalPages}
            </div>
          </div>

          <button
            onClick={handleNext}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-purple-700 transition-colors bg-purple-100 rounded-lg hover:bg-purple-200"
            aria-label="다음 페이지"
          >
            다음
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}