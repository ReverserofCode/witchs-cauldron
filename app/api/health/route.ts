import { NextResponse } from "next/server";

interface HealthResponse {
  ok: boolean;
  ts: number;
}

export async function GET(): Promise<NextResponse<HealthResponse>> {
  const data: HealthResponse = { ok: true, ts: Date.now() };

  return NextResponse.json(data, {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
