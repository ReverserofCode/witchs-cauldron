"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ChzzkLiveStatus } from "@/app/api/chzzkPlayer/chzzkPlayer";

type LiveStatusProviderProps = {
  children: ReactNode;
  initialStatus?: ChzzkLiveStatus;
  pollIntervalMs?: number;
};

type LiveStatusViewModel = {
  liveStatus: ChzzkLiveStatus;
  isRefreshing: boolean;
  liveChipClass: string;
  liveChipLabel: string;
  liveStatusValue: string;
  liveStatusDescription: string;
  viewerSummary: string;
};

const CHANNEL_ID = "1d333ff175b4db5bd06f87a88579ec1e";
const LIVE_STATUS_ENDPOINT = "/api/chzzkPlayer";
const DEFAULT_POLL_INTERVAL_MS = 60_000;
const INITIAL_LIVE_STATUS: ChzzkLiveStatus = {
  channelId: CHANNEL_ID,
  channelUrl: `https://chzzk.naver.com/${CHANNEL_ID}`,
  isLive: false,
  status: "CHECKING",
  title: null,
  startedAt: null,
  thumbnail: null,
  liveId: null,
  viewers: null,
  totalViewers: null,
};

const LiveStatusContext = createContext<LiveStatusViewModel | null>(null);

function useLiveStatusState(
  initialStatus: ChzzkLiveStatus,
  pollIntervalMs: number
): LiveStatusViewModel {
  const [liveStatus, setLiveStatus] = useState<ChzzkLiveStatus>(initialStatus);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const lastRequestAtRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const refreshLiveStatus = async () => {
      const now = Date.now();
      if (now - lastRequestAtRef.current < Math.max(5_000, pollIntervalMs / 2)) return;

      lastRequestAtRef.current = now;
      setIsRefreshing(true);

      try {
        const response = await fetch(LIVE_STATUS_ENDPOINT, {
          headers: { accept: "application/json" },
        });
        const payload = (await response.json()) as ChzzkLiveStatus;

        if (!cancelled) setLiveStatus(payload);
      } catch {
        if (!cancelled) {
          setLiveStatus((current) => ({
            ...current,
            status: current.status === "CHECKING" ? "UNKNOWN" : current.status,
            error: current.error ?? "LIVE_STATUS_UNAVAILABLE",
          }));
        }
      } finally {
        if (!cancelled) setIsRefreshing(false);
      }
    };

    const tick = () => {
      if (document.visibilityState === "hidden") return;
      void refreshLiveStatus();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void refreshLiveStatus();
    };

    tick();
    const intervalId = window.setInterval(tick, pollIntervalMs);
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
    const isChecking = liveStatus.status === "CHECKING";
    const viewerText =
      liveStatus.isLive && typeof liveStatus.viewers === "number" && Number.isFinite(liveStatus.viewers)
        ? ` • ${liveStatus.viewers.toLocaleString()}명 시청중`
        : "";
    const statusTone = liveStatus.isLive
      ? "bg-rose-500/90 border-rose-300/60 text-white"
      : isChecking
        ? "bg-purple-700/75 border-purple-400/60 text-purple-50"
        : "bg-slate-700/80 border-slate-600/70 text-slate-100";

    return {
      liveStatus,
      isRefreshing,
      liveChipClass: `chip inline-flex items-center gap-1.5 border ${statusTone}`,
      liveChipLabel: liveStatus.isLive
        ? `실시간 방송 중${viewerText}`
        : isChecking
          ? "방송 상태 확인 중"
          : "현재 오프라인",
      liveStatusValue: liveStatus.isLive ? "ON AIR" : isChecking ? "CHECK" : "OFF AIR",
      liveStatusDescription: liveStatus.error
        ? "라이브 정보를 불러오지 못했어요. 잠시 후 다시 확인해주세요."
        : liveStatus.isLive
          ? "모잉이 지금도 마법을 선보이는 중입니다!"
          : isChecking
            ? "현재 방송 상태를 확인하고 있습니다."
            : "다음 방송을 기다려주세요.",
      viewerSummary:
        liveStatus.isLive && viewerText
          ? viewerText.replace(" • ", "")
          : isChecking
            ? "치지직 채널에 연결 중입니다."
            : "방송 상태를 주기적으로 확인합니다.",
    };
  }, [isRefreshing, liveStatus]);
}

export function LiveStatusProvider({
  children,
  initialStatus = INITIAL_LIVE_STATUS,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
}: LiveStatusProviderProps) {
  const value = useLiveStatusState(initialStatus, pollIntervalMs);
  return <LiveStatusContext.Provider value={value}>{children}</LiveStatusContext.Provider>;
}

function useLiveStatus() {
  const value = useContext(LiveStatusContext);
  if (!value) throw new Error("Live status components must be rendered inside LiveStatusProvider");
  return value;
}

export function LiveStatusChip() {
  const { liveStatus, isRefreshing, liveChipClass, liveChipLabel } = useLiveStatus();

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

export function LiveStatusDescription() {
  const { liveStatusDescription } = useLiveStatus();
  return <p className="text-sm font-light text-purple-200/85 typography-lead">{liveStatusDescription}</p>;
}

export function LiveStatusCard() {
  const { isRefreshing, liveStatus, liveStatusValue, viewerSummary } = useLiveStatus();

  return (
    <div className="liquid-glass-panel rounded-[24px] px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-purple-200/70">실시간 상태</p>
      <div className="mt-2 flex items-center gap-2">
        <p className="text-xl font-black text-white">{liveStatusValue}</p>
        <span
          className={`inline-flex h-2.5 w-2.5 rounded-full ${liveStatus.isLive ? "bg-rose-400" : "bg-slate-400"} ${isRefreshing ? "animate-pulse" : ""}`}
          aria-hidden="true"
        />
      </div>
      <p className="mt-1 text-xs text-purple-100/75">{viewerSummary}</p>
    </div>
  );
}
