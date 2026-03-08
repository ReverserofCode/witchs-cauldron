import { describe, expect, it } from "vitest";
import type { ScheduleEvent } from "../api/broadCastSchedule/schedule";
import { normalizeScheduleEvent, selectUpcomingScheduleEvents } from "./schedule";

function makeEvent(id: string, start: string, end?: string): ScheduleEvent {
  return {
    id,
    title: id,
    start,
    ...(end ? { end } : {}),
  };
}

describe("schedule normalization", () => {
  it("orders Dec/Jan events across year boundary using one anchor rule", () => {
    const anchor = new Date(Date.UTC(2026, 11, 30, 12, 0, 0));
    const events: ScheduleEvent[] = [
      makeEvent("jan", new Date(Date.UTC(2025, 0, 2, 12, 0, 0)).toISOString()),
      makeEvent("dec", new Date(Date.UTC(2025, 11, 31, 12, 0, 0)).toISOString()),
    ];

    const normalized = selectUpcomingScheduleEvents(events, undefined, anchor);

    expect(normalized.map((event) => event.id)).toEqual(["dec", "jan"]);
    expect(new Date(normalized[0].start).getUTCFullYear()).toBe(2026);
    expect(new Date(normalized[1].start).getUTCFullYear()).toBe(2027);
  });

  it("rolls past events to next year and keeps event duration", () => {
    const anchor = new Date(Date.UTC(2026, 2, 9, 12, 0, 0));
    const past = makeEvent(
      "past",
      new Date(Date.UTC(2025, 2, 1, 12, 0, 0)).toISOString(),
      new Date(Date.UTC(2025, 2, 1, 13, 30, 0)).toISOString()
    );
    const future = makeEvent("future", new Date(Date.UTC(2025, 2, 12, 12, 0, 0)).toISOString());

    const ordered = selectUpcomingScheduleEvents([past, future], undefined, anchor);
    const normalizedPast = normalizeScheduleEvent(past, anchor);

    expect(ordered.map((event) => event.id)).toEqual(["future", "past"]);
    expect(new Date(ordered[0].start).getUTCFullYear()).toBe(2026);
    expect(new Date(ordered[1].start).getUTCFullYear()).toBe(2027);

    expect(normalizedPast).not.toBeNull();
    expect(normalizedPast?.endMs).toBeDefined();
    expect((normalizedPast?.endMs ?? 0) - normalizedPast!.startMs).toBe(90 * 60 * 1000);
  });
});
