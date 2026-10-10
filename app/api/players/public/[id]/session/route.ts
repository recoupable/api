import { getPublicPlayer } from "@/lib/players/getPublicPlayer";
import { publicPlayerResponse } from "@/lib/players/publicPlayerResponse";
export { playerPreflight as OPTIONS } from "@/lib/players/playerPreflight";
/**
 * Acquire or resume a provider session using registered configuration.
 *
 * @param request - Incoming JSON request.
 * @param root0 - Route context.
 * @param root0.params - Registered player identifier.
 * @returns Public settings and signed provider session.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return publicPlayerResponse(request, async () =>
    getPublicPlayer(id, await request.json().catch(() => null), true),
  );
}
