import { describe, expect, it } from "vitest";

import { createGame, transition } from "./session";
import type { Challenge, GameCommand, GameState } from "./types";

const challenge: Challenge = {
  challengeId: "potion-v1:2026-09-15:practice",
  date: "2026-09-15",
  rulesVersion: "potion-v1",
  rounds: Array.from({ length: 5 }, () => ({
    center: 50,
    halfWidth: 10,
    periodMs: 4000,
  })),
};

function command(
  state: GameState,
  type: GameCommand["type"],
  nowMs: number,
): GameCommand {
  return { type, runId: state.runId, roundIndex: state.roundIndex, nowMs };
}

describe("potion timing session", () => {
  it("accepts STOP once and ignores stale rounds", () => {
    const initial = createGame("run-a", "practice", challenge);
    const started = transition(initial, command(initial, "START", 0));
    expect(started.activity?.kind).toBe("game_start");

    const stop = command(started.state, "STOP", 1000);
    const scored = transition(started.state, stop);
    expect(scored.state.scores).toEqual([100]);
    expect(transition(scored.state, stop)).toEqual({ state: scored.state, activity: null });
  });

  it("preserves state when PAUSE is not issued during a running round", () => {
    const ready = createGame("run-pause", "practice", challenge);
    const running = transition(ready, command(ready, "START", 10)).state;
    const roundResult = transition(running, command(running, "STOP", 1010)).state;
    const finished: GameState = { ...roundResult, phase: "finished" };

    for (const state of [ready, roundResult, finished]) {
      expect(transition(state, command(state, "PAUSE", 2000))).toEqual({
        state,
        activity: null,
      });
    }

    const paused = transition(running, command(running, "PAUSE", 2000));
    expect(paused.state).toEqual({ ...running, phase: "paused", startedAtMs: null });
    expect(transition(paused.state, command(paused.state, "PAUSE", 2500))).toEqual({
      state: paused.state,
      activity: null,
    });
    expect(transition(paused.state, command(paused.state, "RESUME", 3000)).state.phase).toBe(
      "ready",
    );
  });

  it("finishes after five accepted stops with at most 500 points and one completion", () => {
    let state = createGame("run-five", "daily", challenge);
    const activities: string[] = [];

    for (let index = 0; index < 5; index += 1) {
      const started = transition(state, command(state, "START", index * 10_000));
      if (started.activity) activities.push(started.activity.kind);
      const stopped = transition(
        started.state,
        command(started.state, "STOP", index * 10_000 + 1000),
      );
      if (stopped.activity) activities.push(stopped.activity.kind);
      state = stopped.state;
      if (index < 4) state = transition(state, command(state, "ADVANCE", 0)).state;
    }

    expect(state.phase).toBe("finished");
    expect(state.scores).toEqual([100, 100, 100, 100, 100]);
    expect(state.scores.reduce((total, score) => total + score, 0)).toBeLessThanOrEqual(500);
    expect(activities).toEqual(["game_start", "game_complete"]);
    expect(transition(state, command(state, "STOP", 99_999)).activity).toBeNull();
  });

  it("ignores commands with stale identity or invalid time", () => {
    const state = createGame("run-current", "practice", challenge);
    const commands: GameCommand[] = [
      { type: "START", runId: "run-old", roundIndex: 0, nowMs: 0 },
      { type: "START", runId: "run-current", roundIndex: 1, nowMs: 0 },
      { type: "START", runId: "run-current", roundIndex: 0, nowMs: Number.NaN },
    ];

    for (const stale of commands) {
      expect(transition(state, stale)).toEqual({ state, activity: null });
    }

    const running = transition(state, command(state, "START", 100)).state;
    expect(transition(running, command(running, "STOP", 99))).toEqual({
      state: running,
      activity: null,
    });
  });

  it("creates clean independent runs and rejects invalid challenges", () => {
    expect(createGame("run-new", "slow-practice", challenge)).toMatchObject({
      runId: "run-new",
      mode: "slow-practice",
      phase: "ready",
      roundIndex: 0,
      scores: [],
      startedAtMs: null,
      hasStarted: false,
    });
    expect(() => createGame("", "practice", challenge)).toThrowError("invalid_run");
    expect(() =>
      createGame("run-bad", "practice", { ...challenge, rounds: challenge.rounds.slice(0, 4) }),
    ).toThrowError("invalid_challenge");
    expect(() =>
      createGame("run-bad", "practice", {
        ...challenge,
        rounds: [{ center: 5, halfWidth: 10, periodMs: 4000 }, ...challenge.rounds.slice(1)],
      }),
    ).toThrowError("invalid_challenge");
  });
});
