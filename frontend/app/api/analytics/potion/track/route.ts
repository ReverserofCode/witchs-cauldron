import { POTION_ALLOWED_ORIGIN, POTION_PILOT_WINDOW } from "../../../../lib/analytics/potion-config";
import { validatePotionPayload } from "../../../../lib/analytics/potion-contract";
import { ensurePotionSchema, getPotionPool, ingestPotionEvent } from "../../../../lib/analytics/potion-db";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 2 * 1024;
const NO_STORE_HEADERS = { "cache-control": "no-store" };

function json(body: unknown, status: number) {
  return Response.json(body, { status, headers: NO_STORE_HEADERS });
}

function isAllowedOrigin(origin: string | null) {
  if (origin === POTION_ALLOWED_ORIGIN) return true;
  if (process.env.NODE_ENV !== "development" && process.env.NODE_ENV !== "test") return false;
  if (!origin) return false;

  try {
    const parsed = new URL(origin);
    return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "[::1]";
  } catch {
    return false;
  }
}

async function readLimitedJson(request: Request): Promise<{ ok: true; value: unknown } | { ok: false; tooLarge: boolean }> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > MAX_BODY_BYTES) {
    return { ok: false, tooLarge: true };
  }
  if (!request.body) return { ok: false, tooLarge: false };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, tooLarge: true };
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return { ok: true, value: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body)) };
  } catch {
    return { ok: false, tooLarge: false };
  }
}

export async function POST(request: Request) {
  const window = POTION_PILOT_WINDOW;
  if (window === null) return new Response(null, { status: 204, headers: NO_STORE_HEADERS });

  if (!isAllowedOrigin(request.headers.get("origin"))) {
    return json({ error: "origin_forbidden" }, 403);
  }

  let parsed: Awaited<ReturnType<typeof readLimitedJson>>;
  try {
    parsed = await readLimitedJson(request);
  } catch {
    return json({ error: "potion_request_unavailable" }, 503);
  }
  if (!parsed.ok) {
    return json({ error: parsed.tooLarge ? "payload_too_large" : "invalid_payload" }, parsed.tooLarge ? 413 : 400);
  }
  const validated = validatePotionPayload(parsed.value);
  if (!validated.ok) return json({ error: "invalid_payload" }, 400);

  const nowMs = Date.now();
  try {
    const pool = await getPotionPool();
    await ensurePotionSchema(pool);
    const result = await ingestPotionEvent(pool, validated.value, nowMs, window);
    if (result.status === 204) return new Response(null, { status: 204, headers: NO_STORE_HEADERS });
    return json(result.body, result.status);
  } catch {
    return json({ error: "potion_database_unavailable" }, 503);
  }
}
