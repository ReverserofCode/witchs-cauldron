import { outreachHandlers } from "@/app/lib/fanart/outreach-handlers";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return outreachHandlers.action(request, (await context.params).id);
}
