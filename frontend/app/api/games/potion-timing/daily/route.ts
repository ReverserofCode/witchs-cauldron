import { POTION_GAME_ENABLED } from "../../../../lib/games/potion-timing/config";
import { getDailyChallenge } from "../../../../lib/games/potion-timing/daily";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!POTION_GAME_ENABLED) return new Response(null, { status: 404 });

  const serverNowMs = Date.now();
  return Response.json(
    { serverNowMs, challenge: getDailyChallenge(serverNowMs) },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
