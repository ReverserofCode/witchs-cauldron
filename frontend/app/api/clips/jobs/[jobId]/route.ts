import { NextRequest, NextResponse } from "next/server";
import {
  isClipApiAuthorized,
  proxyBackendRequest,
  unauthorizedClipApiResponse,
} from "../../_shared";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
): Promise<NextResponse> {
  if (!isClipApiAuthorized(req)) {
    return unauthorizedClipApiResponse();
  }

  const { jobId } = await params;
  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }

  return proxyBackendRequest(
    `/api/jobs/${encodeURIComponent(jobId)}`,
    {
      method: "GET",
    },
    "Failed to fetch job status",
  );
}
