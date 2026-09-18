import { outreachHandlers } from "@/app/lib/fanart/outreach-handlers";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return outreachHandlers.preview(request, (await context.params).id);
}
