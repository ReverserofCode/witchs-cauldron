import { ensurePotionSchema, getPotionPool } from "../../../lib/analytics/potion-db";
import { getPotionSummary, validateCohortRange } from "../../../lib/analytics/potion-summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "cache-control": "private, no-store" };

function json(body: unknown, status: number) {
  return Response.json(body, { status, headers: NO_STORE_HEADERS });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!from || !to || !validateCohortRange(from, to)) {
    return json({ error: "invalid_cohort_range" }, 400);
  }

  try {
    const pool = await getPotionPool();
    await ensurePotionSchema(pool);
    const summary = await getPotionSummary(pool, from, to, Date.now());
    return json(summary, 200);
  } catch {
    return json({ error: "potion_database_unavailable" }, 503);
  }
}
