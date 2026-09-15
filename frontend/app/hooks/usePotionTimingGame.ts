"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { parseDailyResponse } from "@/app/lib/games/potion-timing/daily";
import {
  clearRecords,
  readRecords,
  saveRecord,
  summarizeRecords,
  type RecordStore,
  type RunRecord,
} from "@/app/lib/games/potion-timing/records";
import { makeRounds, positionAt } from "@/app/lib/games/potion-timing/rules";
import { createGame, transition } from "@/app/lib/games/potion-timing/session";
import {
  POTION_ACTIVITY_EVENT,
  type Challenge,
  type GameCommand,
  type GameMode,
  type GameState,
} from "@/app/lib/games/potion-timing/types";

type ExpectedState = Readonly<{ runId: string; roundIndex: number }>;
type PracticeMode = Exclude<GameMode, "daily">;
type DailyStatus = "idle" | "loading" | "ready" | "error";
type SaveStatus = "idle" | "saved" | "unavailable";
export type PotionRecordSummary = ReturnType<typeof summarizeRecords>[number];

export type PotionTimingGameController = Readonly<{
  state: GameState | null;
  dispatch: (type: GameCommand["type"], expected: ExpectedState) => void;
  begin: (
    mode: GameMode,
    challenge: Challenge,
    dailyDeadline?: Readonly<{ expiresAtPerformanceMs: number }>,
  ) => void;
  gaugeRef: React.RefObject<HTMLDivElement | null>;
  dailyStatus: DailyStatus;
  dailyError: string | null;
  recordSummaries: readonly PotionRecordSummary[];
  storageAvailable: boolean;
  saveStatus: SaveStatus;
  startPractice: (mode: PracticeMode) => void;
  startDaily: () => Promise<void>;
  replay: () => void;
  clearSavedRecords: () => boolean;
}>;

const DAILY_URL = "/api/games/potion-timing/daily";
const DAILY_TIMEOUT_MS = 5_000;

function localDateAt(timestampMs: number): string {
  const date = new Date(timestampMs);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getLocalStore(): RecordStore | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function createRunId(): string {
  return crypto.randomUUID();
}

function makePracticeChallenge(runId: string, mode: PracticeMode): Challenge {
  return {
    challengeId: `potion-v1:${runId}:${mode}-seed`,
    date: localDateAt(Date.now()),
    rulesVersion: "potion-v1",
    rounds: makeRounds(runId, mode === "slow-practice"),
  };
}

export function usePotionTimingGame(): PotionTimingGameController {
  const [state, setState] = useState<GameState | null>(null);
  const [dailyStatus, setDailyStatus] = useState<DailyStatus>("idle");
  const [dailyError, setDailyError] = useState<string | null>(null);
  const [recordSummaries, setRecordSummaries] = useState<readonly PotionRecordSummary[]>([]);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const stateRef = useRef<GameState | null>(null);
  const gaugeRef = useRef<HTMLDivElement>(null);
  const lastGaugePositionRef = useRef(0);
  const dailyDeadlineRef = useRef<{
    runId: string;
    expiresAtPerformanceMs: number;
  } | null>(null);
  const requestGenerationRef = useRef(0);
  const dailyAbortRef = useRef<AbortController | null>(null);
  const selectedModeRef = useRef<GameMode | null>(null);
  const startDailyRef = useRef<() => Promise<void>>(async () => undefined);

  const refreshRecords = useCallback(() => {
    const store = getLocalStore();
    if (!store) {
      setStorageAvailable(false);
      setRecordSummaries([]);
      return;
    }
    const result = readRecords(store, Date.now());
    setStorageAvailable(result.storageAvailable);
    setRecordSummaries(summarizeRecords(result.records));
  }, []);

  const applyGame = useCallback(
    (
      runId: string,
      mode: GameMode,
      challenge: Challenge,
      dailyDeadline?: Readonly<{ expiresAtPerformanceMs: number }>,
    ) => {
      const nextState = createGame(runId, mode, challenge);
      selectedModeRef.current = mode;
      dailyDeadlineRef.current =
        mode === "daily" && dailyDeadline
          ? { runId, expiresAtPerformanceMs: dailyDeadline.expiresAtPerformanceMs }
          : null;
      lastGaugePositionRef.current = 0;
      stateRef.current = nextState;
      setState(nextState);
      setSaveStatus("idle");
      setDailyError(null);
      setDailyStatus(mode === "daily" ? "ready" : "idle");
    },
    [],
  );

  const cancelDailyRequest = useCallback(() => {
    requestGenerationRef.current += 1;
    dailyAbortRef.current?.abort();
    dailyAbortRef.current = null;
  }, []);

  const begin = useCallback(
    (
      mode: GameMode,
      challenge: Challenge,
      dailyDeadline?: Readonly<{ expiresAtPerformanceMs: number }>,
    ) => {
      cancelDailyRequest();
      applyGame(createRunId(), mode, challenge, dailyDeadline);
    },
    [applyGame, cancelDailyRequest],
  );

  const storeCompletion = useCallback(
    (finishedState: GameState) => {
      const completedAtMs = Date.now();
      const challengeDate =
        finishedState.mode === "daily"
          ? finishedState.challenge.date
          : localDateAt(completedAtMs);
      const challengeId =
        finishedState.mode === "daily"
          ? finishedState.challenge.challengeId
          : `potion-v1:${challengeDate}:${finishedState.mode}`;
      const record: RunRecord = {
        schemaVersion: 1,
        runId: finishedState.runId,
        mode: finishedState.mode,
        rulesVersion: finishedState.challenge.rulesVersion,
        challengeId,
        challengeDate,
        completedAtMs,
        scores: [...finishedState.scores],
        total: finishedState.scores.reduce((sum, score) => sum + score, 0),
      };
      const store = getLocalStore();
      const stored = store ? saveRecord(store, record) : false;
      setSaveStatus(stored ? "saved" : "unavailable");
      if (stored) refreshRecords();
      else setStorageAvailable(false);
    },
    [refreshRecords],
  );

  const dispatch = useCallback(
    (type: GameCommand["type"], expected: ExpectedState) => {
      const current = stateRef.current;
      if (!current) return;
      if (
        current.runId !== expected.runId ||
        current.roundIndex !== expected.roundIndex
      ) {
        return;
      }

      const nowMs = performance.now();

      if (
        type === "START" &&
        current.mode === "daily" &&
        !current.hasStarted &&
        dailyDeadlineRef.current?.runId === current.runId &&
        nowMs >= dailyDeadlineRef.current.expiresAtPerformanceMs
      ) {
        void startDailyRef.current();
        return;
      }

      if (type === "STOP" && current.phase === "running" && current.startedAtMs !== null) {
        const rule = current.challenge.rounds[current.roundIndex];
        const position = positionAt(nowMs - current.startedAtMs, rule.periodMs);
        const gauge = gaugeRef.current;
        lastGaugePositionRef.current = position;
        if (gauge) {
          gauge.style.transform = `translateX(${position}%)`;
          gauge.dataset.position = position.toFixed(2);
          gauge.setAttribute("aria-valuenow", String(Math.round(position)));
        }
      }

      const result = transition(current, {
        type,
        runId: expected.runId,
        roundIndex: expected.roundIndex,
        nowMs,
      });
      stateRef.current = result.state;
      setState(result.state);
      if (result.activity) {
        window.dispatchEvent(
          new CustomEvent(POTION_ACTIVITY_EVENT, { detail: result.activity }),
        );
        if (result.activity.kind === "game_complete") {
          storeCompletion(result.state);
        }
      }
    },
    [storeCompletion],
  );

  const startPractice = useCallback(
    (mode: PracticeMode) => {
      cancelDailyRequest();
      selectedModeRef.current = mode;
      const runId = createRunId();
      applyGame(runId, mode, makePracticeChallenge(runId, mode));
    },
    [applyGame, cancelDailyRequest],
  );

  const startDaily = useCallback(async () => {
    const generation = requestGenerationRef.current + 1;
    requestGenerationRef.current = generation;
    dailyAbortRef.current?.abort();
    const controller = new AbortController();
    dailyAbortRef.current = controller;
    selectedModeRef.current = "daily";
    stateRef.current = null;
    setState(null);
    setDailyStatus("loading");
    setDailyError(null);
    setSaveStatus("idle");

    const timeoutId = window.setTimeout(() => controller.abort(), DAILY_TIMEOUT_MS);
    try {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const requestedAtPerformanceMs = performance.now();
        const response = await fetch(DAILY_URL, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("daily_unavailable");
        const parsed = parseDailyResponse(await response.json());
        if (!parsed) throw new Error("daily_invalid");
        const receivedAtPerformanceMs = performance.now();
        const expectedServerNowMs =
          parsed.serverNowMs +
          (receivedAtPerformanceMs - requestedAtPerformanceMs);

        if (expectedServerNowMs >= parsed.challenge.endsAtMs) {
          if (attempt === 0) continue;
          throw new Error("daily_expired");
        }
        if (
          requestGenerationRef.current !== generation ||
          selectedModeRef.current !== "daily" ||
          controller.signal.aborted
        ) {
          return;
        }

        const runId = createRunId();
        applyGame(runId, "daily", parsed.challenge, {
          expiresAtPerformanceMs:
            receivedAtPerformanceMs +
            (parsed.challenge.endsAtMs - expectedServerNowMs),
        });
        return;
      }
    } catch (error) {
      if (
        requestGenerationRef.current !== generation ||
        selectedModeRef.current !== "daily"
      ) {
        return;
      }
      setDailyStatus("error");
      setDailyError(
        error instanceof DOMException && error.name === "AbortError"
          ? "오늘의 도전 확인 시간이 초과됐어요. 연습은 이용할 수 있어요."
          : "오늘의 도전을 확인하지 못했어요. 연습은 이용할 수 있어요.",
      );
    } finally {
      window.clearTimeout(timeoutId);
      if (dailyAbortRef.current === controller) dailyAbortRef.current = null;
    }
  }, [applyGame]);

  useEffect(() => {
    startDailyRef.current = startDaily;
  }, [startDaily]);

  const replay = useCallback(() => {
    const current = stateRef.current;
    if (!current || current.phase !== "finished") return;
    if (current.mode === "daily") void startDaily();
    else startPractice(current.mode);
  }, [startDaily, startPractice]);

  const clearSavedRecords = useCallback(() => {
    const store = getLocalStore();
    if (!store) {
      setStorageAvailable(false);
      return false;
    }
    const cleared = clearRecords(store);
    if (cleared) {
      setRecordSummaries([]);
      setStorageAvailable(true);
      setSaveStatus("idle");
    } else {
      setStorageAvailable(false);
    }
    return cleared;
  }, []);

  useEffect(() => {
    const initialRead = window.setTimeout(refreshRecords, 0);
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key.startsWith("wc:potion:run:v1:")) {
        refreshRecords();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.clearTimeout(initialRead);
      window.removeEventListener("storage", onStorage);
    };
  }, [refreshRecords]);

  useEffect(() => {
    const pauseRunningRound = () => {
      const current = stateRef.current;
      if (current?.phase === "running") {
        dispatch("PAUSE", {
          runId: current.runId,
          roundIndex: current.roundIndex,
        });
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") pauseRunningRound();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", pauseRunningRound);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", pauseRunningRound);
    };
  }, [dispatch]);

  useEffect(() => {
    return () => {
      requestGenerationRef.current += 1;
      dailyAbortRef.current?.abort();
      dailyAbortRef.current = null;
    };
  }, []);

  useEffect(() => {
    const gauge = gaugeRef.current;
    if (!gauge) return;

    if (!state || state.phase === "ready" || state.phase === "paused") {
      lastGaugePositionRef.current = 0;
      gauge.style.transform = "translateX(0%)";
      gauge.dataset.position = "0";
      gauge.setAttribute("aria-valuenow", "0");
      return;
    }
    if (state.phase !== "running" || state.startedAtMs === null) return;

    let animationFrame = 0;
    const runId = state.runId;
    const roundIndex = state.roundIndex;
    const periodMs = state.challenge.rounds[roundIndex].periodMs;
    const updateGauge = (nowMs: number) => {
      const current = stateRef.current;
      if (
        current?.phase !== "running" ||
        current.runId !== runId ||
        current.roundIndex !== roundIndex ||
        current.startedAtMs === null
      ) {
        return;
      }
      const position = positionAt(nowMs - current.startedAtMs, periodMs);
      lastGaugePositionRef.current = position;
      gauge.style.transform = `translateX(${position}%)`;
      gauge.dataset.position = position.toFixed(2);
      gauge.setAttribute("aria-valuenow", String(Math.round(position)));
      animationFrame = window.requestAnimationFrame(updateGauge);
    };
    animationFrame = window.requestAnimationFrame(updateGauge);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [state]);

  return {
    state,
    dispatch,
    begin,
    gaugeRef,
    dailyStatus,
    dailyError,
    recordSummaries,
    storageAvailable,
    saveStatus,
    startPractice,
    startDaily,
    replay,
    clearSavedRecords,
  };
}
