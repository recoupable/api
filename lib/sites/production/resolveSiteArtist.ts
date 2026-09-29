import { z } from "zod";
import { callContextRpc } from "@/lib/supabase/context_requests/callContextRpc";
import { selectArtistOrganizationIds } from "@/lib/supabase/artist_organization_ids/selectArtistOrganizationIds";
import type { Site, SiteSnapshot } from "../schema";

/** Attribute URL-only sites to the first credited artist in their owned context request. */
export async function resolveSiteArtist(site: Site, draft: SiteSnapshot) {
  if (site.artist_id) return site.artist_id;
  const requestId = draft.production?.context.engine?.requestIds[0];
  if (!requestId) return null;
  const request = z
    .object({
      output: z.object({ artists: z.array(z.object({ artistId: z.uuid(), order: z.number() })) }),
    })
    .safeParse(
      await callContextRpc("read_context_request", {
        p_owner: site.owner_id,
        p_request: requestId,
      }),
    );
  if (!request.success) return null;
  const artist = [...request.data.output.artists].sort((a, b) => a.order - b.order)[0];
  if (!artist) return null;
  const owners = await selectArtistOrganizationIds(artist.artistId);
  return owners?.some(row => row.organization_id === site.owner_id) ? artist.artistId : null;
}
