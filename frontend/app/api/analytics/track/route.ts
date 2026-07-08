import { NextRequest, NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { ensureSchema, getPool } from "../db";
import {
  createIpHash,
  createVisitorKey,
  getKstDateString,
  normalizeReferrerHost,
  resolveAnalyticsHashSecret,
  validateAnalyticsPayload,
} from "../../../lib/analytics/contract";

export const runtime = "nodejs";

const SESSION_COOKIE = "wc_session";

async function getClientIp() {
  const reqHeaders = await headers();
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

async function getUserAgent() {
  return (await headers()).get("user-agent") ?? null;
}

function detectDeviceType(ua: string | null): "mobile" | "tablet" | "desktop" {
  if (!ua) return "desktop";
  const lower = ua.toLowerCase();
  if (/tablet|ipad|playbook|silk/i.test(lower)) return "tablet";
  if (/mobile|iphone|ipod|android.*mobile|windows phone|blackberry/i.test(lower)) return "mobile";
  if (/android/i.test(lower)) return "tablet"; // Android without "mobile" → tablet
  return "desktop";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => ({}));
  const validated = validateAnalyticsPayload(payload);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: validated.status });
  }

  let hashSecret: string;
  try {
    hashSecret = resolveAnalyticsHashSecret();
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "analytics_hash_secret_missing" },
      { status: 503 }
    );
  }

  const cookieStore = await cookies();
  const rawSessionId = cookieStore.get(SESSION_COOKIE)?.value ?? "";
  let isNewSession = !rawSessionId;
  let sessionId = rawSessionId;

  if (!sessionId || !isUuid(sessionId)) {
    sessionId = crypto.randomUUID();
    isNewSession = true;
  }

  const ip = await getClientIp();
  const userAgent = await getUserAgent();
  const ipHash = createIpHash(ip, hashSecret);
  const visitorKey = createVisitorKey(sessionId, ipHash);
  const referrerHost = normalizeReferrerHost(validated.referrer);
  const eventDateKst = getKstDateString();
  const metadata = { ...validated.metadata, device_type: detectDeviceType(userAgent) };

  await ensureSchema();
  const pool = await getPool();
  await pool.query(
    `
      INSERT INTO analytics_sessions (session_id, ip, user_agent, first_seen, last_seen)
      VALUES ($1, $2, $3, now(), now())
      ON CONFLICT (session_id)
      DO UPDATE SET ip = EXCLUDED.ip, user_agent = EXCLUDED.user_agent, last_seen = now();
    `,
    [sessionId, "redacted", userAgent]
  );

  await pool.query(
    `
      INSERT INTO analytics_events
        (
          event_id,
          session_id,
          ip,
          ip_hash,
          visitor_key,
          event_type,
          path,
          referrer,
          referrer_host,
          element_type,
          element_id,
          element_label,
          metadata,
          event_date_kst
        )
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::date)
      ON CONFLICT DO NOTHING;
    `,
    [
      validated.eventId,
      sessionId,
      "redacted",
      ipHash,
      visitorKey,
      validated.eventType,
      validated.path,
      validated.referrer,
      referrerHost,
      validated.elementType,
      validated.elementId,
      validated.elementLabel,
      metadata,
      eventDateKst,
    ]
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
