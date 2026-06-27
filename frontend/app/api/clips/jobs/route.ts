import { NextRequest, NextResponse } from "next/server";
import {
  isClipApiAuthorized,
  proxyBackendRequest,
  unauthorizedClipApiResponse,
} from "../_shared";

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isClipApiAuthorized(req)) {
    return unauthorizedClipApiResponse();
  }

  const limitRaw = req.nextUrl.searchParams.get("limit");
  const limit = Math.min(Math.max(Number(limitRaw ?? 10), 1), 50);

  return proxyBackendRequest(
    `/api/jobs?limit=${limit}`,
    {
      method: "GET",
    },
    "Failed to fetch jobs",
  );
}
