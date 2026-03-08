import type { ScheduleEvent } from "../api/broadCastSchedule/schedule";

export interface NormalizedScheduleEvent {
  event: ScheduleEvent;
  startMs: number;
  endMs: number;
}

export function normalizeScheduleEvent(
  event: ScheduleEvent,
  anchor: Date = new Date()
): NormalizedScheduleEvent | null {
  const startDate = new Date(event.start);
  if (Number.isNaN(startDate.getTime())) {
    return null;
  }

  const projectedStart = new Date(startDate);
  projectedStart.setFullYear(anchor.getFullYear());
  if (projectedStart.getTime() < anchor.getTime()) {
    projectedStart.setFullYear(anchor.getFullYear() + 1);
  }

  const { end: _, ...eventWithoutEnd } = event;
  const startMs = projectedStart.getTime();
  const duration = event.end ? Date.parse(event.end) - startDate.getTime() : 0;
  const safeDuration = Number.isFinite(duration) ? Math.max(duration, 0) : 0;
  const endMs = startMs + safeDuration;

  const normalizedEvent: ScheduleEvent = {
    ...eventWithoutEnd,
    start: new Date(startMs).toISOString(),
  };

  if (event.end && Number.isFinite(Date.parse(event.end))) {
    normalizedEvent.end = new Date(endMs).toISOString();
  }

  return {
    event: normalizedEvent,
    startMs,
    endMs,
  };
}

export function normalizeScheduleEvents(
  events: ScheduleEvent[],
  anchor: Date = new Date()
): NormalizedScheduleEvent[] {
  return events
    .map((event) => normalizeScheduleEvent(event, anchor))
    .filter((value): value is NormalizedScheduleEvent => Boolean(value))
    .sort((a, b) => a.startMs - b.startMs);
}

export function selectUpcomingScheduleEvents(
  events: ScheduleEvent[],
  limit?: number,
  anchor: Date = new Date()
): ScheduleEvent[] {
  const normalized = normalizeScheduleEvents(events, anchor);
  const now = anchor.getTime();

  const upcoming = normalized.filter((item) => item.startMs >= now || item.endMs >= now);
  const source = upcoming.length > 0 ? upcoming : normalized;

  if (typeof limit === "number" && Number.isFinite(limit) && limit > 0) {
    return source.slice(0, limit).map((item) => item.event);
  }

  return source.map((item) => item.event);
}

export function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function addDays(date: Date, amount: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
}

export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}
