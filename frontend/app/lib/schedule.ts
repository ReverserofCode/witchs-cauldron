import type { ScheduleEvent } from "../api/broadCastSchedule/schedule";

export interface NormalizedScheduleEvent {
  event: ScheduleEvent;
  startMs: number;
  endMs: number;
}

export interface CalendarMonthDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  events: ScheduleEvent[];
}

export function normalizeScheduleEvent(
  event: ScheduleEvent,
  _anchor: Date = new Date()
): NormalizedScheduleEvent | null {
  const startDate = new Date(event.start);
  if (Number.isNaN(startDate.getTime())) {
    return null;
  }

  const { end: _, ...eventWithoutEnd } = event;
  const startMs = startDate.getTime();
  const duration = event.end ? Date.parse(event.end) - startDate.getTime() : 0;
  const safeDuration = Number.isFinite(duration) ? Math.max(duration, 0) : 0;
  const endMs = startMs + safeDuration;

  const normalizedEvent: ScheduleEvent = {
    ...eventWithoutEnd,
    start: startDate.toISOString(),
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

  const source = normalized.filter((item) => item.startMs >= now || item.endMs >= now);

  if (typeof limit === "number" && Number.isFinite(limit) && limit > 0) {
    return source.slice(0, limit).map((item) => item.event);
  }

  return source.map((item) => item.event);
}

export function selectScheduleWindowEvents(
  events: ScheduleEvent[],
  daysToShow: number,
  anchor: Date = new Date()
): { events: ScheduleEvent[]; range: { start: string; end: string } } {
  const normalized = normalizeScheduleEvents(events, anchor);
  const currentWeekStart = startOfWeek(anchor);
  const currentWeek = filterNormalizedEventsWithinRange(normalized, currentWeekStart, daysToShow);

  if (currentWeek.events.length > 0) {
    return currentWeek;
  }

  const now = anchor.getTime();
  const nextEvent = normalized.find((item) => item.startMs >= now || item.endMs >= now);
  if (nextEvent) {
    return filterNormalizedEventsWithinRange(normalized, startOfWeek(new Date(nextEvent.startMs)), daysToShow);
  }

  return currentWeek;
}

export function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function startOfWeek(date: Date): Date {
  const copy = startOfDay(date);
  copy.setDate(copy.getDate() - copy.getDay());
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

export function buildCalendarMonthDays(
  month: Date,
  events: ScheduleEvent[],
  todayDate: Date = new Date()
): CalendarMonthDay[] {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDay = new Date(year, monthIndex, 1);
  const lastDay = new Date(year, monthIndex + 1, 0);
  const startDate = startOfWeek(firstDay);
  const endDate = addDays(startOfWeek(lastDay), 6);
  const today = startOfDay(todayDate);
  const eventsByDate = new Map<string, Array<{ event: ScheduleEvent; startMs: number }>>();

  for (const event of events) {
    const startMs = Date.parse(event.start);
    if (!Number.isFinite(startMs)) {
      continue;
    }

    const dateKey = formatDateKey(new Date(startMs));
    const bucket = eventsByDate.get(dateKey);
    const entry = { event, startMs };

    if (bucket) {
      bucket.push(entry);
    } else {
      eventsByDate.set(dateKey, [entry]);
    }
  }

  const days: CalendarMonthDay[] = [];

  for (let current = new Date(startDate); current <= endDate; current = addDays(current, 1)) {
    const dateKey = formatDateKey(current);
    const dayEvents = (eventsByDate.get(dateKey) ?? [])
      .sort((a, b) => a.startMs - b.startMs)
      .map((entry) => entry.event);

    days.push({
      date: new Date(current),
      isCurrentMonth: current.getMonth() === monthIndex,
      isToday: current.getTime() === today.getTime(),
      isWeekend: current.getDay() === 0 || current.getDay() === 6,
      events: dayEvents,
    });
  }

  return days;
}

function filterNormalizedEventsWithinRange(
  events: NormalizedScheduleEvent[],
  anchorDate: Date,
  daysToShow: number
): { events: ScheduleEvent[]; range: { start: string; end: string } } {
  const start = startOfDay(anchorDate);
  const end = addDays(start, Math.max(1, Math.trunc(daysToShow)));
  const rangeStartMs = start.getTime();
  const rangeEndMs = end.getTime();

  const filtered = events
    .filter(({ startMs, endMs }) => {
      const startsInRange = startMs >= rangeStartMs && startMs < rangeEndMs;
      const endsInRange = endMs >= rangeStartMs && endMs < rangeEndMs;
      const spansRange = startMs < rangeStartMs && endMs >= rangeStartMs;

      return startsInRange || endsInRange || spansRange;
    })
    .sort((a, b) => a.startMs - b.startMs)
    .map((item) => item.event);

  return {
    events: filtered,
    range: {
      start: start.toISOString(),
      end: end.toISOString(),
    },
  };
}
