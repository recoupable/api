export { playerPreflight as OPTIONS } from "@/lib/players/playerPreflight";
import { getPublicPlayer } from "@/lib/players/getPublicPlayer";
import { publicPlayerResponse } from "@/lib/players/publicPlayerResponse";
/** Acquire or resume a provider session using registered configuration. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return publicPlayerResponse(request, async () =>
    getPublicPlayer(id, await request.json().catch(() => null), true),
  );
}
