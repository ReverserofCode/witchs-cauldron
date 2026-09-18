import { fanArtHandlers } from "@/app/lib/fanart/handlers";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const { id } = await context.params;
  return fanArtHandlers.withdraw(request, id);
}
