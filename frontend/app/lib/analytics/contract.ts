import { createHmac } from "node:crypto";

export const ANALYTICS_TIME_ZONE = "Asia/Seoul" as const;
export const ANALYTICS_SCHEMA_VERSION = 2;
export const MAX_ANALYTICS_RANGE_DAYS = 366;
export const RETENTION_WINDOW_DAYS = 30;
export const METADATA_MAX_BYTES = 4096;

export const ANALYTICS_EVENT_TYPES = [
  "pageview",
  "menu_click",
  "content_click",
  "section_view",
  "scroll_depth",
  "page_exit",
] as const;

export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number];

export type AnalyticsMetadata = Record<string, string | number | boolean | null>;

type AnalyticsPayloadResult =
  | {
      ok: true;
      eventType: AnalyticsEventType;
      path: string | null;
      referrer: string | null;
      eventId: string | null;
      elementType: string | null;
      elementId: string | null;
      elementLabel: string | null;
      metadata: AnalyticsMetadata;
    }
  | {
      ok: false;
      status: 400 | 413;
      error: "invalid_event_type" | "invalid_metadata" | "payload_too_large";
    };

type AnalyticsRangeResult =
  | {
      ok: true;
      from: string;
      to: string;
      fromUtcIso: string;
      toExclusiveUtcIso: string;
      days: number;
      timeZone: typeof ANALYTICS_TIME_ZONE;
      maxRangeDays: typeof MAX_ANALYTICS_RANGE_DAYS;
    }
  | {
      ok: false;
      status: 400;
      error: "range_too_large";
      maxRangeDays: typeof MAX_ANALYTICS_RANGE_DAYS;
    };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const NUMERIC_METADATA_LIMITS = {
  threshold: { min: 0, max: 100 },
  depth: { min: 0, max: 100 },
  dwell_seconds: { min: 0, max: 86_400 },
  max_scroll_depth: { min: 0, max: 100 },
} as const;
const ALLOWED_SCROLL_THRESHOLDS = new Set([25, 50, 75, 100]);
const ALLOWED_STRING_METADATA = new Set(["location", "device_type", "device_category"]);
const ALLOWED_DEVICE_TYPES = new Set(["mobile", "tablet", "desktop", "unknown"]);

export function safeAnalyticsText(value: unknown, limit = 500) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, limit);
}

export function isAnalyticsEventType(value: unknown): value is AnalyticsEventType {
  return typeof value === "string" && ANALYTICS_EVENT_TYPES.includes(value as AnalyticsEventType);
}

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

export function kstDateToUtcIso(value: string) {
  return new Date(`${value}T00:00:00.000+09:00`).toISOString();
}

function normalizeDateParam(value: string | null | undefined, fallback: string) {
  if (!value || !DATE_RE.test(value)) return fallback;
  const utcMs = dateStringToUtcMs(value);
  if (utcMs === null) return fallback;
  return new Date(utcMs).toISOString().slice(0, 10);
}

export function parseAnalyticsDateRange({
  from,
  to,
  now = new Date(),
}: {
  from?: string | null;
  to?: string | null;
  now?: Date;
}): AnalyticsRangeResult {
  const today = getKstDateString(now);
  const defaultFrom = addDaysToDateString(today, -6);
  let fromDate = normalizeDateParam(from, defaultFrom);
  let toDate = normalizeDateParam(to, today);

  if ((dateStringToUtcMs(toDate) ?? 0) < (dateStringToUtcMs(fromDate) ?? 0)) {
    toDate = fromDate;
  }

  const fromMs = dateStringToUtcMs(fromDate) ?? 0;
  const toMs = dateStringToUtcMs(toDate) ?? fromMs;
  const days = Math.floor((toMs - fromMs) / DAY_MS) + 1;

  if (days > MAX_ANALYTICS_RANGE_DAYS) {
    return {
      ok: false,
      status: 400,
      error: "range_too_large",
      maxRangeDays: MAX_ANALYTICS_RANGE_DAYS,
    };
  }

  return {
    ok: true,
    from: fromDate,
    to: toDate,
    fromUtcIso: kstDateToUtcIso(fromDate),
    toExclusiveUtcIso: kstDateToUtcIso(addDaysToDateString(toDate, 1)),
    days,
    timeZone: ANALYTICS_TIME_ZONE,
    maxRangeDays: MAX_ANALYTICS_RANGE_DAYS,
  };
}

export function normalizeReferrerHost(referrer: unknown) {
  const value = safeAnalyticsText(referrer, 512);
  if (!value) return "(direct)";

  try {
    const parsed = new URL(value);
    if (parsed.protocol === "android-app:") {
      return `android-app://${parsed.hostname.toLowerCase()}`;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "(direct)";
    return parsed.hostname.toLowerCase() || "(direct)";
  } catch {
    return "(direct)";
  }
}

function jsonByteLength(value: unknown) {
  return Buffer.byteLength(JSON.stringify(value ?? {}), "utf8");
}

function sanitizeStringMetadata(key: string, value: unknown) {
  const limit = key === "location" ? 128 : 32;
  const text = safeAnalyticsText(value, limit);
  if (!text) return null;
  if ((key === "device_type" || key === "device_category") && !ALLOWED_DEVICE_TYPES.has(text)) {
    return null;
  }
  return text;
}

function sanitizeNumericMetadata(key: keyof typeof NUMERIC_METADATA_LIMITS, value: unknown) {
  const numberValue = typeof value === "number" ? value : Number(value);
  const limits = NUMERIC_METADATA_LIMITS[key];
  if (!Number.isFinite(numberValue) || numberValue < limits.min || numberValue > limits.max) {
    return null;
  }
  if (key === "threshold" && !ALLOWED_SCROLL_THRESHOLDS.has(numberValue)) {
    return null;
  }
  return Math.round(numberValue);
}

export function validateAnalyticsPayload(payload: unknown): AnalyticsPayloadResult {
  const record = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const eventType = safeAnalyticsText(record.type, 64);
  if (!isAnalyticsEventType(eventType)) {
    return { ok: false, status: 400, error: "invalid_event_type" };
  }

  const rawMetadata = record.metadata && typeof record.metadata === "object" ? record.metadata : {};
  if (jsonByteLength(rawMetadata) > METADATA_MAX_BYTES) {
    return { ok: false, status: 413, error: "payload_too_large" };
  }

  const metadata: AnalyticsMetadata = {};
  for (const [key, value] of Object.entries(rawMetadata as Record<string, unknown>)) {
    if (ALLOWED_STRING_METADATA.has(key)) {
      const sanitized = sanitizeStringMetadata(key, value);
      if (!sanitized) return { ok: false, status: 400, error: "invalid_metadata" };
      metadata[key] = sanitized;
      continue;
    }

    if (key in NUMERIC_METADATA_LIMITS) {
      const sanitized = sanitizeNumericMetadata(key as keyof typeof NUMERIC_METADATA_LIMITS, value);
      if (sanitized === null) return { ok: false, status: 400, error: "invalid_metadata" };
      metadata[key] = sanitized;
      continue;
    }

    return { ok: false, status: 400, error: "invalid_metadata" };
  }

  const element = record.element && typeof record.element === "object" ? (record.element as Record<string, unknown>) : {};

  return {
    ok: true,
    eventType,
    path: safeAnalyticsText(record.path, 512),
    referrer: safeAnalyticsText(record.referrer, 512),
    eventId: safeAnalyticsText(record.event_id, 36),
    elementType: safeAnalyticsText(element.type, 64),
    elementId: safeAnalyticsText(element.id, 512),
    elementLabel: safeAnalyticsText(element.label, 128),
    metadata,
  };
}

export function resolveAnalyticsHashSecret(env: Partial<NodeJS.ProcessEnv> = process.env) {
  const configured = env.ANALYTICS_HASH_SECRET?.trim();
  if (configured) return configured;
  if (env.NODE_ENV === "production") {
    throw new Error("analytics_hash_secret_missing");
  }
  return "development-analytics-secret";
}

export function createIpHash(ip: string, secret: string) {
  return createHmac("sha256", secret).update(ip || "unknown").digest("hex");
}

export function createVisitorKey(sessionId: string | null | undefined, ipHash: string) {
  const normalizedSession = safeAnalyticsText(sessionId, 64);
  if (normalizedSession) return `session:${normalizedSession}`;
  return `ip:${ipHash}`;
}
