"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type YTPlayerStateValue = -1 | 0 | 1 | 2 | 3 | 5;

interface YTPlayerStateMap {
  ENDED: 0;
  PLAYING: 1;
  PAUSED: 2;
  BUFFERING: 3;
  CUED: 5;
}

interface YTPlayerEvent {
  data: YTPlayerStateValue;
}

interface YTPlayerInstance {
  destroy: () => void;
  getPlayerState?: () => YTPlayerStateValue;
}

interface YTNamespace {
  Player: new (
    element: HTMLElement,
    config: {
      videoId: string;
      playerVars?: Record<string, string | number>;
      events?: {
        onStateChange?: (event: YTPlayerEvent) => void;
      };
    }
  ) => YTPlayerInstance;
  PlayerState: YTPlayerStateMap;
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
    __youtubeIframeApiPromise?: Promise<YTNamespace>;
  }
}

function loadYouTubeIframeApi(): Promise<YTNamespace> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("YouTube iframe API is only available in the browser."));
  }

  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }

  if (window.__youtubeIframeApiPromise) {
    return window.__youtubeIframeApiPromise;
  }

  window.__youtubeIframeApiPromise = new Promise<YTNamespace>((resolve) => {
    const previousReady = window.onYouTubeIframeAPIReady;

    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      if (window.YT?.Player) {
        resolve(window.YT);
      }
    };

    const existingScript = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (!existingScript) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      document.head.appendChild(script);
    }
  });

  return window.__youtubeIframeApiPromise;
}

interface VideoCardProps {
  video: {
    videoId: string;
    title: string;
    thumbnail?: string;
    url: string;
    channelTitle?: string;
    publishedAt?: string;
    viewCount?: number | null;
  };
  aspect?: "video" | "short";
  embed?: boolean;
  onInteractionStart?: () => void;
  onPlaybackStart?: () => void;
  onPlaybackStop?: () => void;
}

export default function VideoCard({
  video,
  aspect = "video",
  embed = false,
  onInteractionStart,
  onPlaybackStart,
  onPlaybackStop,
}: VideoCardProps) {
  const { videoId, thumbnail, title, url, channelTitle, publishedAt, viewCount } = video;
  const aspectClass = aspect === "short" ? "aspect-[9/16]" : "aspect-video";
  const fallbackSrc = "/mainPage/SDCharacter.png";
  const displayChannel = channelTitle ?? "모잉 팬 채널";
  const displayDate = publishedAt ? new Date(publishedAt).toLocaleDateString("ko-KR") : null;
  const displayViews =
    typeof viewCount === "number" && Number.isFinite(viewCount)
      ? new Intl.NumberFormat("ko-KR").format(viewCount)
      : null;
  const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1`;
  const [useIframeFallback, setUseIframeFallback] = useState(false);
  const [isEmbedActivated, setIsEmbedActivated] = useState(!embed);
  const playerHostRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayerInstance | null>(null);
  const playbackStartRef = useRef(onPlaybackStart);
  const playbackStopRef = useRef(onPlaybackStop);
  const lastPlayerStateRef = useRef<YTPlayerStateValue | null>(null);

  useEffect(() => {
    playbackStartRef.current = onPlaybackStart;
    playbackStopRef.current = onPlaybackStop;
  }, [onPlaybackStart, onPlaybackStop]);

  useEffect(() => {
    setIsEmbedActivated(!embed);
  }, [embed, videoId]);

  useEffect(() => {
    if (!embed || !isEmbedActivated || !playerHostRef.current) {
      return;
    }

    let disposed = false;
    let statePollTimer: number | null = null;
    setUseIframeFallback(false);

    const syncPlaybackState = (state: YTPlayerStateValue, YT: YTNamespace) => {
      if (lastPlayerStateRef.current === state) {
        return;
      }

      lastPlayerStateRef.current = state;

      if (state === YT.PlayerState.PLAYING) {
        playbackStartRef.current?.();
        return;
      }

      if (state === YT.PlayerState.PAUSED || state === YT.PlayerState.ENDED) {
        playbackStopRef.current?.();
      }
    };

    const mountPlayer = async () => {
      const YT = await loadYouTubeIframeApi();
      if (disposed || !playerHostRef.current) {
        return;
      }

      playerRef.current?.destroy();
      playerRef.current = new YT.Player(playerHostRef.current, {
        videoId,
        playerVars: {
          enablejsapi: 1,
          modestbranding: 1,
          origin: window.location.origin,
          playsinline: 1,
          rel: 0,
        },
        events: {
          onStateChange: (event) => {
            syncPlaybackState(event.data, YT);
          },
        },
      });

      statePollTimer = window.setInterval(() => {
        const nextState = playerRef.current?.getPlayerState?.();
        if (typeof nextState === "number") {
          syncPlaybackState(nextState, YT);
        }
      }, 1000);
    };

    mountPlayer().catch(() => {
      if (!disposed) {
        setUseIframeFallback(true);
      }
    });

    return () => {
      disposed = true;
      if (statePollTimer !== null) {
        window.clearInterval(statePollTimer);
      }
      playerRef.current?.destroy();
      playerRef.current = null;
      lastPlayerStateRef.current = null;
    };
  }, [embed, isEmbedActivated, videoId]);

  const activateEmbed = () => {
    onInteractionStart?.();
    setIsEmbedActivated(true);
  };

  if (embed) {
    return (
      <div
        className="flex h-full flex-col overflow-hidden rounded-2xl border border-purple-200/40 bg-gradient-to-b from-purple-50/50 to-white shadow-md"
        title={title}
      >
        <div
          className={`relative w-full overflow-hidden bg-black ${aspectClass}`}
        >
          {!isEmbedActivated ? (
            <button
              type="button"
              onClick={activateEmbed}
              className="group absolute inset-0 h-full w-full text-left"
              aria-label={`${title} 재생`}
            >
              <Image
                src={thumbnail || fallbackSrc}
                alt={title}
                fill
                unoptimized
                sizes="(max-width: 768px) 100vw, 480px"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/10" />
              <div className="absolute inset-x-4 bottom-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">
                    빠른 미리보기
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm font-semibold text-white">
                    클릭해서 바로 재생
                  </p>
                </div>
                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/90 text-purple-700 shadow-lg transition-transform duration-200 group-hover:scale-105">
                  <svg className="ml-0.5 h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
              </div>
            </button>
          ) : useIframeFallback ? (
            <iframe
              src={embedUrl}
              title={title}
              className="absolute inset-0 h-full w-full"
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          ) : (
            <div ref={playerHostRef} className="absolute inset-0 h-full w-full" />
          )}
          {displayViews && (
            <div className="absolute bottom-2 right-2 rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
              {displayViews}회
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2 p-3 bg-gradient-to-b from-white to-purple-50/30">
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-purple-950">
            {title}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-purple-700/60">
            <span className="font-medium">{displayChannel}</span>
            {displayDate && (
              <>
                <span className="h-1 w-1 rounded-full bg-purple-400/50" />
                <span>{displayDate}</span>
              </>
            )}
          </div>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-auto inline-flex items-center justify-center rounded-full border border-purple-200/70 bg-white/90 px-3 py-2 text-[11px] font-semibold text-purple-700 transition-colors hover:border-purple-300 hover:bg-purple-50"
          >
            YouTube에서 보기
          </a>
        </div>
      </div>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-purple-200/40 bg-gradient-to-b from-purple-50/50 to-white shadow-md transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-purple-200/40 hover:border-purple-300/60"
      title={title}
    >
      {/* Thumbnail Container */}
      <div className="relative w-full overflow-hidden">
        {/* Thumbnail Image with Zoom Effect */}
        <div className={`relative w-full ${aspectClass}`}>
          <Image
            src={thumbnail || fallbackSrc}
            alt={title}
            fill
            unoptimized
            sizes={aspect === "short" ? "(max-width: 768px) 60vw, 320px" : "(max-width: 768px) 100vw, 480px"}
            className="object-cover transition-transform duration-500 group-hover:scale-110"
          />
        </div>

        {/* Play Button Overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all duration-300 group-hover:bg-black/20">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 shadow-lg opacity-0 scale-75 transition-all duration-300 group-hover:opacity-100 group-hover:scale-100">
            <svg
              className="h-6 w-6 text-purple-600 ml-1"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>

        {/* Duration/Views Badge */}
        {displayViews && (
          <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/70 text-[10px] font-medium text-white backdrop-blur-sm">
            {displayViews}회
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="flex flex-col flex-1 gap-1.5 p-3 bg-gradient-to-b from-white to-purple-50/30">
        <p className="text-sm font-semibold text-purple-950 line-clamp-2 leading-snug group-hover:text-purple-700 transition-colors">
          {title}
        </p>
        <div className="mt-auto flex items-center gap-2 text-[11px] text-purple-700/60">
          <span className="font-medium">{displayChannel}</span>
          {displayDate && (
            <>
              <span className="h-1 w-1 rounded-full bg-purple-400/50" />
              <span>{displayDate}</span>
            </>
          )}
        </div>
      </div>
    </a>
  );
}
