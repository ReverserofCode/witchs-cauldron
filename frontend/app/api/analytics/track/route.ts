import { NextRequest, NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { ensureSchema, getPool } from "../db";

export const runtime = "nodejs";

const SESSION_COOKIE = "wc_session";

function getClientIp() {
  const reqHeaders = headers();
  const forwarded = reqHeaders.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }
  return (
    reqHeaders.get("x-real-ip") ||
    reqHeaders.get("cf-connecting-ip") ||
    "unknown"
  );
}

function getUserAgent() {
  return headers().get("user-agent") ?? null;
}

function detectDeviceType(ua: string | null): "mobile" | "tablet" | "desktop" {
  if (!ua) return "desktop";
  const lower = ua.toLowerCase();
  if (/tablet|ipad|playbook|silk/i.test(lower)) return "tablet";
  if (/mobile|iphone|ipod|android.*mobile|windows phone|blackberry/i.test(lower)) return "mobile";
  if (/android/i.test(lower)) return "tablet"; // Android without "mobile" → tablet
  return "desktop";
}

function safeText(value: unknown, limit = 500) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, limit);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(request: NextRequest) {
  await ensureSchema();

  const payload = await request.json().catch(() => ({}));
  const eventType = safeText(payload?.type, 64);
  if (!eventType) {
    return NextResponse.json({ error: "invalid_event_type" }, { status: 400 });
  }

  const cookieStore = cookies();
  const rawSessionId = cookieStore.get(SESSION_COOKIE)?.value ?? "";
  let isNewSession = !rawSessionId;
  let sessionId = rawSessionId;

  if (!sessionId || !isUuid(sessionId)) {
    sessionId = crypto.randomUUID();
    isNewSession = true;
  }

  const ip = getClientIp();
  const userAgent = getUserAgent();
  const path = safeText(payload?.path, 512);
  const referrer = safeText(payload?.referrer, 512);
  const eventId = safeText(payload?.event_id, 36);
  const elementType = safeText(payload?.element?.type, 64);
  const elementId = safeText(payload?.element?.id, 512);
  const elementLabel = safeText(payload?.element?.label, 128);
  const rawMetadata = payload?.metadata && typeof payload.metadata === "object" ? payload.metadata : {};
  const metadata = { ...rawMetadata, device_type: detectDeviceType(userAgent) };

  const pool = await getPool();
  await pool.query(
    `
      INSERT INTO analytics_sessions (session_id, ip, user_agent, first_seen, last_seen)
      VALUES ($1, $2, $3, now(), now())
      ON CONFLICT (session_id)
      DO UPDATE SET ip = EXCLUDED.ip, user_agent = EXCLUDED.user_agent, last_seen = now();
    `,
    [sessionId, ip, userAgent]
  );

  await pool.query(
    `
      INSERT INTO analytics_events
        (event_id, session_id, ip, event_type, path, referrer, element_type, element_id, element_label, metadata)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT DO NOTHING;
    `,
    [eventId, sessionId, ip, eventType, path, referrer, elementType, elementId, elementLabel, metadata]
  );

  const response = NextResponse.json({ ok: true });
  if (isNewSession) {
    response.cookies.set(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return response;
}
