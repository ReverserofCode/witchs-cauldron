import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";
const COLLECT_API_KEY = process.env.COLLECT_API_KEY || "";

function isAuthorized(req: NextRequest): boolean {
  if (!COLLECT_API_KEY) return true;

  const xApiKey = req.headers.get("x-api-key") || "";
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : "";

  return xApiKey === COLLECT_API_KEY || bearer === COLLECT_API_KEY;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const upstream = await fetch(`${BACKEND_URL}/api/jobs/automation`, {
      method: "GET",
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
        error: "Failed to fetch clip automation status",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 502 },
    );
  }
}
