import { z } from "zod";
import { authorizeSiteWorkspace } from "@/lib/sites/authorizeSiteWorkspace";
import { selectReleasePlayer } from "@/lib/supabase/release_players/selectReleasePlayer";
import { getPlayerReport } from "@/lib/supabase/player_listening_events/getPlayerReport";
import { SiteError } from "@/lib/sites/SiteError";
export async function readPlayerReport(accountId: string, id: string, input: unknown) {
  z.string().uuid().parse(id);
  const value = z
    .object({
      organizationId: z.string().uuid().nullable().default(null),
      offset: z.coerce.number().int().min(0).max(100000).default(0),
    })
    .strict()
    .parse(input);
  const owner = await authorizeSiteWorkspace(accountId, value.organizationId),
    player = await selectReleasePlayer(id);
  if (!player || player.owner_id !== owner) throw new SiteError(404, "Player not found");
  return {
    measurement: "browser_reported_playback",
    dspStreams: null,
    periodDays: 30,
    offset: value.offset,
    limit: 100,
    report: await getPlayerReport(owner, id, value.offset),
  };
}
