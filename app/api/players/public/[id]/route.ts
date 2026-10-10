import { getPublicPlayer } from "@/lib/players/getPublicPlayer";
import { publicPlayerResponse } from "@/lib/players/publicPlayerResponse";
/**
 * Public settings and signed listening session for a registered release player.
 *
 * @param request - Incoming HTTP request.
 * @param root0 - Route context.
 * @param root0.params - Player route parameters.
 * @returns HTTP response.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return publicPlayerResponse(request, () =>
    getPublicPlayer(id, Object.fromEntries(new URL(request.url).searchParams)),
  );
}
