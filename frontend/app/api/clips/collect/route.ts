import { NextRequest, NextResponse } from "next/server";

interface CollectRequestBody {
  max_clips?: number;
  filter_type?: "ALL" | "WEEKLY" | "MONTHLY" | string;
  order_type?: "POPULAR" | "RECENT" | "MIXED" | string;
}

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";
const COLLECT_API_KEY = process.env.COLLECT_API_KEY || "";
const MAX_CLIPS_PER_COLLECTION = 10;

function isAuthorized(req: NextRequest): boolean {
  if (!COLLECT_API_KEY) return true; // optional auth

  const xApiKey = req.headers.get("x-api-key") || "";
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : "";

  return xApiKey === COLLECT_API_KEY || bearer === COLLECT_API_KEY;
}

function normalizeMaxClips(value: unknown): number {
  const parsed = Number(value ?? 5);
  if (!Number.isFinite(parsed)) return 5;

  return Math.min(Math.max(Math.floor(parsed), 1), MAX_CLIPS_PER_COLLECTION);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  let body: CollectRequestBody = {};
  try {
    body = (await req.json()) as CollectRequestBody;
  } catch {
    // allow empty body (defaults below)
  }

  const payload: CollectRequestBody = {
    max_clips: normalizeMaxClips(body.max_clips),
    filter_type: body.filter_type ?? "ALL",
    order_type: body.order_type ?? "POPULAR",
  };

  try {
    const upstream = await fetch(`${BACKEND_URL}/api/clips/collect`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const text = await upstream.text();

    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") || "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to trigger collection",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 502 },
    );
  }
}
