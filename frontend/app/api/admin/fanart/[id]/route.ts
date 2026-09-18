import { fanArtHandlers } from "@/app/lib/fanart/handlers";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  const { id } = await context.params;
  return fanArtHandlers.detail(request, id);
}

export async function PATCH(request: Request, context: Context) {
  const { id } = await context.params;
  return fanArtHandlers.review(request, id);
}
