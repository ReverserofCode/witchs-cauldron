import { NextResponse } from "next/server";

export function GET() {
  return new NextResponse(null, { status: 204 });
}

export const dynamic = "force-dynamic";
