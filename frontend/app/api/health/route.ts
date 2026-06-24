// Health check API
// - GET /api/health
// - Returns { ok: boolean, ts: number }
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface HealthResponse {
  ok: boolean;
  ts: number;
}

/**
 * Health endpoint
 * @returns 200 OK with { ok: true, ts: epochMillis }
 */
export async function GET(): Promise<NextResponse<HealthResponse>> {
  const data: HealthResponse = { ok: true, ts: Date.now() };

  return NextResponse.json(data, {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, max-age=0",
    },
  });
}
