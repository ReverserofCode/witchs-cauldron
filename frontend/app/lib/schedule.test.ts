import { describe, expect, it } from "vitest";
import type { ScheduleEvent } from "../api/broadCastSchedule/schedule";
import {
  formatDateKey,
  normalizeScheduleEvent,
  selectScheduleWindowEvents,
  selectUpcomingScheduleEvents,
} from "./schedule";

function makeEvent(id: string, start: string, end?: string): ScheduleEvent {
  return {
    id,
    title: id,
    start,
    ...(end ? { end } : {}),
  };
}

describe("schedule normalization", () => {
  it("orders Dec/Jan events by their actual resolved date", () => {
    const anchor = new Date(Date.UTC(2026, 11, 30, 12, 0, 0));
    const events: ScheduleEvent[] = [
      makeEvent("jan", new Date(Date.UTC(2027, 0, 2, 12, 0, 0)).toISOString()),
      makeEvent("dec", new Date(Date.UTC(2026, 11, 31, 12, 0, 0)).toISOString()),
    ];

    const normalized = selectUpcomingScheduleEvents(events, undefined, anchor);

    expect(normalized.map((event) => event.id)).toEqual(["dec", "jan"]);
    expect(new Date(normalized[0].start).getUTCFullYear()).toBe(2026);
    expect(new Date(normalized[1].start).getUTCFullYear()).toBe(2027);
  });

  it("does not expose past events as upcoming broadcasts", () => {
    const anchor = new Date(Date.UTC(2026, 2, 9, 12, 0, 0));
    const past = makeEvent("past", new Date(Date.UTC(2026, 2, 1, 12, 0, 0)).toISOString());

    expect(selectUpcomingScheduleEvents([past], undefined, anchor)).toEqual([]);
  });

  it("keeps event duration while preserving the event date", () => {
    const past = makeEvent(
      "past",
      new Date(Date.UTC(2026, 2, 1, 12, 0, 0)).toISOString(),
      new Date(Date.UTC(2026, 2, 1, 13, 30, 0)).toISOString()
    );
    const normalizedPast = normalizeScheduleEvent(past);

    expect(normalizedPast).not.toBeNull();
    expect(new Date(normalizedPast!.event.start).getUTCFullYear()).toBe(2026);
    expect(normalizedPast?.endMs).toBeDefined();
    expect((normalizedPast?.endMs ?? 0) - normalizedPast!.startMs).toBe(90 * 60 * 1000);
  });

  it("selects the current weekly schedule window including earlier days in the same week", () => {
    const anchor = new Date(Date.UTC(2026, 5, 27, 12, 0, 0));
    const events: ScheduleEvent[] = [
      makeEvent("fri", new Date(Date.UTC(2026, 5, 26, 11, 0, 0)).toISOString()),
      makeEvent("next", new Date(Date.UTC(2026, 6, 3, 11, 0, 0)).toISOString()),
    ];

    const result = selectScheduleWindowEvents(events, 7, anchor);

    expect(result.events.map((event) => event.id)).toEqual(["fri"]);
    expect(formatDateKey(new Date(result.range.start))).toBe("2026-06-21");
    expect(formatDateKey(new Date(result.range.end))).toBe("2026-06-28");
  });

  it("falls forward to the next event week when the current week is empty", () => {
    const anchor = new Date(Date.UTC(2026, 5, 27, 12, 0, 0));
    const nextWeek = makeEvent("next-week", new Date(Date.UTC(2026, 6, 3, 11, 0, 0)).toISOString());

    const result = selectScheduleWindowEvents([nextWeek], 7, anchor);

    expect(result.events.map((event) => event.id)).toEqual(["next-week"]);
    expect(formatDateKey(new Date(result.range.start))).toBe("2026-06-28");
    expect(formatDateKey(new Date(result.range.end))).toBe("2026-07-05");
  });
});
