import { NextRequest, NextResponse } from "next/server";

export const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";
export const MAX_CLIPS_PER_COLLECTION = 2;

const COLLECT_API_KEY = process.env.COLLECT_API_KEY || "";
const CLIP_COLLECTION_REQUIRES_API_KEY =
  (process.env.CLIP_COLLECTION_REQUIRES_API_KEY ??
    (process.env.NODE_ENV === "production" ? "true" : "false")).toLowerCase() !== "false";

export function isClipApiAuthorized(req: NextRequest): boolean {
  if (!COLLECT_API_KEY) return !CLIP_COLLECTION_REQUIRES_API_KEY;

  const xApiKey = req.headers.get("x-api-key") || "";
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : "";

  return xApiKey === COLLECT_API_KEY || bearer === COLLECT_API_KEY;
}

export function unauthorizedClipApiResponse(): NextResponse {
  if (!COLLECT_API_KEY && CLIP_COLLECTION_REQUIRES_API_KEY) {
    return NextResponse.json(
      { error: "Clip collection API key is not configured" },
      { status: 503 },
    );
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function normalizeMaxClips(value: unknown): number {
  const parsed = Number(value ?? 1);
  if (!Number.isFinite(parsed)) return 1;

  return Math.min(Math.max(Math.floor(parsed), 1), MAX_CLIPS_PER_COLLECTION);
}

export async function proxyBackendRequest(
  pathname: string,
  init: RequestInit,
  errorMessage: string,
): Promise<NextResponse> {
  try {
    const upstream = await fetch(`${BACKEND_URL}${pathname}`, {
      cache: "no-store",
      ...init,
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
        error: errorMessage,
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 502 },
    );
  }
}
