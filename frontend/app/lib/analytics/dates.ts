export const ANALYTICS_TIME_ZONE = "Asia/Seoul" as const;
export const MAX_ANALYTICS_RANGE_DAYS = 366;

const DAY_MS = 24 * 60 * 60 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function dateStringToUtcMs(value: string) {
  const parsed = new Date(`${value}T00:00:00.000Z`).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

export function addDaysToDateString(value: string, days: number) {
  const utcMs = dateStringToUtcMs(value);
  if (utcMs === null) return value;
  return new Date(utcMs + days * DAY_MS).toISOString().slice(0, 10);
}

export function getKstDateString(date = new Date()) {
  return new Date(date.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}
