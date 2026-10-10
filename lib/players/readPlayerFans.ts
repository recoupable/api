import { z } from "zod";
import { authorizeSiteWorkspace } from "@/lib/sites/authorizeSiteWorkspace";
import { selectReleasePlayer } from "@/lib/supabase/release_players/selectReleasePlayer";
import { selectPlayerFans } from "@/lib/supabase/player_fans/selectPlayerFans";
import { SiteError } from "@/lib/sites/SiteError";
export async function readPlayerFans(accountId: string, id: string, input: unknown) {
  z.string().uuid().parse(id);
  const value = z
    .object({
      organizationId: z.string().uuid().nullable().default(null),
      offset: z.coerce.number().int().min(0).max(100000).default(0),
      limit: z.coerce.number().int().min(1).max(100).default(50),
    })
    .strict()
    .parse(input);
  const owner = await authorizeSiteWorkspace(accountId, value.organizationId),
    player = await selectReleasePlayer(id);
  if (!player || player.owner_id !== owner) throw new SiteError(404, "Player not found");
  return {
    fans: await selectPlayerFans(owner, player.artist_id, value.offset, value.limit),
    scope: "artist_in_workspace",
    marketingConsent: false,
    offset: value.offset,
    limit: value.limit,
  };
}
