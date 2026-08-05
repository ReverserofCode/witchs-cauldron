import { createHmac } from "node:crypto";
import {
  ANALYTICS_TIME_ZONE,
  MAX_ANALYTICS_RANGE_DAYS,
  addDaysToDateString,
  getKstDateString,
} from "./dates";

export const ANALYTICS_SCHEMA_VERSION = 2;
export const RETENTION_WINDOW_DAYS = 30;
export const METADATA_MAX_BYTES = 4096;

export {
  ANALYTICS_TIME_ZONE,
  MAX_ANALYTICS_RANGE_DAYS,
  addDaysToDateString,
  getKstDateString,
} from "./dates";

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
const NUMERIC_METADATA_LIMITS = {
  threshold: { min: 0, max: 100 },
  depth: { min: 0, max: 100 },
  dwell_seconds: { min: 0, max: 86_400 },
  max_scroll_depth: { min: 0, max: 100 },
  visibility_ratio: { min: 0, max: 1 },
} as const;
const ALLOWED_SCROLL_THRESHOLDS = new Set([25, 50, 75, 100]);
const ALLOWED_STRING_METADATA = new Set(["location", "device_type", "device_category"]);
const ALLOWED_DEVICE_TYPES = new Set(["mobile", "tablet", "desktop", "unknown"]);
const COMMON_HOST_PREFIX_RE = /^(?:www|m|mobile)\./;
const TRACKING_QUERY_PARAM_RE =
  /^(?:utm_|fbclid$|gclid$|dclid$|yclid$|mc_|ref$|ref_src$|spm$|feature$|view$|si$|igshid$)/i;

export function safeAnalyticsText(value: unknown, limit = 500) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, limit);
}

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeHost(value: string) {
  return value.toLowerCase().replace(/\.$/, "").replace(COMMON_HOST_PREFIX_RE, "");
}

function normalizePathname(value: string, { lowercase = false } = {}) {
  const [withoutHash] = value.split("#", 1);
  const [withoutQuery] = withoutHash.split("?", 1);
  let path = withoutQuery.trim() || "/";
  if (!path.startsWith("/")) path = `/${path}`;
  path = path.replace(/\/{2,}/g, "/");
  if (path.length > 1) path = path.replace(/\/+$/, "");
  return lowercase ? path.toLowerCase() : path;
}

function normalizeSearchParams(searchParams: URLSearchParams) {
  const kept = Array.from(searchParams.entries())
    .filter(([key]) => !TRACKING_QUERY_PARAM_RE.test(key))
    .sort(([left], [right]) => left.localeCompare(right));
  if (kept.length === 0) return "";
  return `?${new URLSearchParams(kept).toString()}`;
}

export function normalizeAnalyticsPath(value: unknown) {
  const text = safeAnalyticsText(value, 512);
  if (!text) return null;

  try {
    if (/^https?:\/\//i.test(text)) {
      const parsed = new URL(text);
      return normalizePathname(parsed.pathname, { lowercase: true });
    }
  } catch {
    return normalizePathname(text, { lowercase: true });
  }

  return normalizePathname(text, { lowercase: true });
}

export function normalizeElementLabel(value: unknown, limit = 128) {
  const text = safeAnalyticsText(value, limit);
  if (!text) return null;
  return collapseWhitespace(text).slice(0, limit);
}

export function normalizeDimensionKey(value: unknown, limit = 512) {
  const text = safeAnalyticsText(value, limit);
  if (!text) return null;

  try {
    if (/^https?:\/\//i.test(text)) {
      const parsed = new URL(text);
      const path = normalizePathname(parsed.pathname);
      const query = normalizeSearchParams(parsed.searchParams);
      return `${parsed.protocol}//${normalizeHost(parsed.hostname)}${path}${query}`.slice(0, limit);
    }
  } catch {
    // Fall through to string dimension normalization.
  }

  if (text.startsWith("/")) {
    return normalizeAnalyticsPath(text)?.slice(0, limit) ?? null;
  }

  if (text.startsWith("#")) {
    const anchor = collapseWhitespace(text.slice(1)).toLowerCase();
    return anchor ? `#${anchor}`.slice(0, limit) : null;
  }

  return collapseWhitespace(text).toLowerCase().slice(0, limit);
}

export function isAnalyticsEventType(value: unknown): value is AnalyticsEventType {
  return typeof value === "string" && ANALYTICS_EVENT_TYPES.includes(value as AnalyticsEventType);
}

function dateStringToUtcMs(value: string) {
  const parsed = new Date(`${value}T00:00:00.000Z`).getTime();
  if (Number.isNaN(parsed)) return null;

  return new Date(parsed).toISOString().slice(0, 10) === value ? parsed : null;
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
  const fromDate = normalizeDateParam(from, defaultFrom);
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
    return normalizeHost(parsed.hostname) || "(direct)";
  } catch {
    return "(direct)";
  }
}

function jsonByteLength(value: unknown) {
  return Buffer.byteLength(JSON.stringify(value ?? {}), "utf8");
}

function sanitizeStringMetadata(key: string, value: unknown) {
  const limit = key === "location" ? 128 : 32;
  const text = key === "location" ? normalizeDimensionKey(value, limit) : safeAnalyticsText(value, limit)?.toLowerCase();
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
  if (key === "visibility_ratio") {
    return Math.round(numberValue * 1000) / 1000;
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
    path: normalizeAnalyticsPath(record.path),
    referrer: safeAnalyticsText(record.referrer, 512),
    eventId: safeAnalyticsText(record.event_id, 36),
    elementType: normalizeDimensionKey(element.type, 64),
    elementId: normalizeDimensionKey(element.id, 512),
    elementLabel: normalizeElementLabel(element.label, 128),
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
