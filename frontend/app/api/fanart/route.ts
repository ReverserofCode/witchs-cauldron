import { fanArtHandlers } from "@/app/lib/fanart/handlers";

export const runtime = "nodejs";

export function GET(request: Request) {
  return fanArtHandlers.publicList(request);
}
