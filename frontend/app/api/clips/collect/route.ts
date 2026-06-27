import { NextRequest, NextResponse } from "next/server";
import {
  isClipApiAuthorized,
  normalizeMaxClips,
  proxyBackendRequest,
  unauthorizedClipApiResponse,
} from "../_shared";

interface CollectRequestBody {
  max_clips?: number;
  filter_type?: "ALL" | "WEEKLY" | "MONTHLY" | string;
  order_type?: "POPULAR" | "RECENT" | "MIXED" | string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isClipApiAuthorized(req)) {
    return unauthorizedClipApiResponse();
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
    order_type: body.order_type ?? "RECENT",
  };

  return proxyBackendRequest(
    "/api/clips/collect",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    "Failed to trigger collection",
  );
}
