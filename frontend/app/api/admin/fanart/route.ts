import { fanArtHandlers } from "@/app/lib/fanart/handlers";

export const runtime = "nodejs";

export function GET(request: Request) {
  return fanArtHandlers.adminList(request);
}

export function POST(request: Request) {
  return fanArtHandlers.create(request);
}
