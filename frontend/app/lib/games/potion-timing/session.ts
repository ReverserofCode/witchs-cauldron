import { isValidRoundRule, positionAt, scoreAt } from "./rules";
import type {
  Challenge,
  GameActivity,
  GameCommand,
  GameMode,
  GameState,
  Transition,
} from "./types";

const MODES: readonly GameMode[] = ["daily", "practice", "slow-practice"];

function unchanged(state: GameState): Transition {
  return { state, activity: null };
}

function activity(state: GameState, kind: GameActivity["kind"]): GameActivity {
  return {
    kind,
    runId: state.runId,
    mode: state.mode,
    rulesVersion: state.challenge.rulesVersion,
  };
}

export function createGame(runId: string, mode: GameMode, challenge: Challenge): GameState {
  if (typeof runId !== "string" || runId.trim().length === 0 || !MODES.includes(mode)) {
    throw new RangeError("invalid_run");
  }
  if (
    challenge.rulesVersion !== "potion-v1" ||
    typeof challenge.challengeId !== "string" ||
    challenge.challengeId.length === 0 ||
    typeof challenge.date !== "string" ||
    challenge.date.length === 0 ||
    !Array.isArray(challenge.rounds) ||
    challenge.rounds.length !== 5 ||
    challenge.rounds.some((rule) => !isValidRoundRule(rule))
  ) {
    throw new RangeError("invalid_challenge");
  }

  return {
    runId,
    mode,
    challenge,
    phase: "ready",
    roundIndex: 0,
    scores: [],
    startedAtMs: null,
    hasStarted: false,
  };
}

export function transition(state: GameState, command: GameCommand): Transition {
  if (
    command.runId !== state.runId ||
    command.roundIndex !== state.roundIndex ||
    !Number.isFinite(command.nowMs)
  ) {
    return unchanged(state);
  }

  if (command.type === "START") {
    if (state.phase !== "ready") return unchanged(state);
    const wasStarted = state.hasStarted;
    return {
      state: { ...state, phase: "running", startedAtMs: command.nowMs, hasStarted: true },
      activity: wasStarted ? null : activity(state, "game_start"),
    };
  }

  if (command.type === "STOP") {
    if (
      state.phase !== "running" ||
      state.startedAtMs === null ||
      command.nowMs < state.startedAtMs ||
      state.scores.length !== state.roundIndex ||
      state.scores.length >= 5
    ) {
      return unchanged(state);
    }

    const rule = state.challenge.rounds[state.roundIndex];
    if (!rule) return unchanged(state);
    const score = scoreAt(
      positionAt(command.nowMs - state.startedAtMs, rule.periodMs),
      rule,
    );
    const scores = [...state.scores, score];
    const finished = scores.length === 5;
    return {
      state: {
        ...state,
        scores,
        startedAtMs: null,
        phase: finished ? "finished" : "round-result",
      },
      activity: finished ? activity(state, "game_complete") : null,
    };
  }

  if (command.type === "ADVANCE") {
    if (state.phase !== "round-result" || state.roundIndex >= 4) return unchanged(state);
    return {
      state: { ...state, roundIndex: state.roundIndex + 1, phase: "ready" },
      activity: null,
    };
  }

  if (command.type === "PAUSE") {
    if (state.phase !== "running") return unchanged(state);
    return {
      state: { ...state, phase: "paused", startedAtMs: null },
      activity: null,
    };
  }

  if (command.type === "RESUME" && state.phase === "paused") {
    return {
      state: { ...state, phase: "ready", startedAtMs: null },
      activity: null,
    };
  }

  return unchanged(state);
}
