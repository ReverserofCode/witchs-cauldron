"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChzzkLiveStatus } from "@/app/api/chzzkPlayer/chzzkPlayer";

interface BaseProps {
  initialStatus: ChzzkLiveStatus;
  pollIntervalMs?: number;
}

const LIVE_STATUS_ENDPOINT = "/api/chzzkPlayer";
const DEFAULT_POLL_INTERVAL_MS = 60_000;

function useLiveStatus(initialStatus: ChzzkLiveStatus, pollIntervalMs = DEFAULT_POLL_INTERVAL_MS) {
  const [liveStatus, setLiveStatus] = useState<ChzzkLiveStatus>(initialStatus);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const lastRequestAtRef = useRef(0);

  useEffect(() => {
    setLiveStatus(initialStatus);
  }, [initialStatus]);

  useEffect(() => {
    let cancelled = false;

    const refreshLiveStatus = async () => {
      const now = Date.now();
      if (now - lastRequestAtRef.current < Math.max(5_000, pollIntervalMs / 2)) return;

      lastRequestAtRef.current = now;
      setIsRefreshing(true);

      try {
        const res = await fetch(LIVE_STATUS_ENDPOINT, {
          cache: "no-store",
          headers: { accept: "application/json" },
        });

        if (!res.ok) throw new Error(`live status request failed: ${res.status}`);
        const payload = (await res.json()) as ChzzkLiveStatus;
        if (!cancelled) setLiveStatus(payload);
      } catch {
        // 기존 상태 유지
      } finally {
        if (!cancelled) setIsRefreshing(false);
      }
    };

    const tick = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      void refreshLiveStatus();
    };

    const intervalId = window.setInterval(tick, pollIntervalMs);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void refreshLiveStatus();
    };

    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [pollIntervalMs]);

  return useMemo(() => {
    const viewerText =
      liveStatus.isLive && typeof liveStatus.viewers === "number" && Number.isFinite(liveStatus.viewers)
        ? ` • ${liveStatus.viewers.toLocaleString()}명 시청중`
        : "";

    return {
      liveStatus,
      isRefreshing,
      liveChipClass: `chip inline-flex items-center gap-1.5 border ${
        liveStatus.isLive
          ? "bg-rose-500/90 border-rose-300/60 text-white"
          : "bg-slate-700/80 border-slate-600/70 text-slate-100"
      }`,
      liveChipLabel: liveStatus.isLive ? `실시간 방송 중${viewerText}` : "현재 오프라인",
      liveStatusValue: liveStatus.isLive ? "ON AIR" : "OFF AIR",
      liveStatusDescription: liveStatus.error
        ? "라이브 정보를 불러오지 못했어요. 잠시 후 다시 확인해주세요."
        : liveStatus.isLive
          ? "모잉이 지금도 마법을 선보이는 중입니다!"
          : "다음 방송을 기다려주세요.",
      viewerSummary:
        liveStatus.isLive && viewerText ? viewerText.replace(" • ", "") : "방송 상태를 주기적으로 확인합니다.",
    };
  }, [isRefreshing, liveStatus]);
}

export function LiveStatusChip({ initialStatus, pollIntervalMs }: BaseProps) {
  const { liveStatus, isRefreshing, liveChipClass, liveChipLabel } = useLiveStatus(initialStatus, pollIntervalMs);

  return (
    <a
      href={liveStatus.channelUrl}
      target="_blank"
      rel="noreferrer"
      className={`${liveChipClass} ml-auto transition-all duration-200 hover:scale-105 hover:brightness-110`}
    >
      <span className={`inline-block h-1.5 w-1.5 rounded-full bg-current sm:h-2 sm:w-2 ${isRefreshing ? "animate-pulse" : ""}`} />
      <span className="text-xs sm:text-sm">{liveChipLabel}</span>
    </a>
  );
}

export function LiveStatusDescription({ initialStatus, pollIntervalMs }: BaseProps) {
  const { liveStatusDescription } = useLiveStatus(initialStatus, pollIntervalMs);

  return <p className="text-sm font-light text-purple-200/85 typography-lead">{liveStatusDescription}</p>;
}

export function LiveStatusCard({ initialStatus, pollIntervalMs }: BaseProps) {
  const { isRefreshing, liveStatus, liveStatusValue, viewerSummary } = useLiveStatus(initialStatus, pollIntervalMs);

  return (
    <div className="liquid-glass-panel rounded-[24px] px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-purple-200/70">실시간 상태</p>
      <div className="mt-2 flex items-center gap-2">
        <p className="text-xl font-black text-white">{liveStatusValue}</p>
        <span
          className={`inline-flex h-2.5 w-2.5 rounded-full ${liveStatus.isLive ? "bg-rose-400" : "bg-slate-400"} ${isRefreshing ? "animate-pulse" : ""}`}
          aria-hidden
        />
      </div>
      <p className="mt-1 text-xs text-purple-100/75">{viewerSummary}</p>
    </div>
  );
}
