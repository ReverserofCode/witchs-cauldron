import { NextResponse } from "next/server";
import { getClipCatalog } from "@/app/lib/clips/catalog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CACHE_CONTROL = "public, max-age=15, stale-while-revalidate=45";

export async function GET(request: Request) {
  const catalog = await getClipCatalog();
  const etag = `W/"${catalog.version}"`;
  const headers = {
    "Cache-Control": CACHE_CONTROL,
    ETag: etag,
  };

  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers });
  }

  return NextResponse.json(catalog, { headers });
}
