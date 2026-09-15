export type RuleVersion = "potion-v1";

export type GameMode = "daily" | "practice" | "slow-practice";

export type RoundRule = Readonly<{
  center: number;
  halfWidth: number;
  periodMs: number;
}>;

export type Challenge = Readonly<{
  challengeId: string;
  date: string;
  rulesVersion: RuleVersion;
  rounds: readonly RoundRule[];
}>;

export type GameActivity = Readonly<{
  kind: "game_start" | "game_complete";
  runId: string;
  mode: GameMode;
  rulesVersion: RuleVersion;
}>;

export const POTION_ACTIVITY_EVENT = "wc:potion-activity:v1";

export type GameState = Readonly<{
  runId: string;
  mode: GameMode;
  challenge: Challenge;
  phase: "ready" | "running" | "round-result" | "paused" | "finished";
  roundIndex: number;
  scores: readonly number[];
  startedAtMs: number | null;
  hasStarted: boolean;
}>;

export type GameCommand = Readonly<{
  type: "START" | "STOP" | "ADVANCE" | "PAUSE" | "RESUME";
  runId: string;
  roundIndex: number;
  nowMs: number;
}>;

export type Transition = Readonly<{
  state: GameState;
  activity: GameActivity | null;
}>;
