import { randomUUID } from "node:crypto";
import { z } from "zod";
import { selectReleasePlayer } from "@/lib/supabase/release_players/selectReleasePlayer";
import { insertPlayerSession } from "@/lib/supabase/player_sessions/insertPlayerSession";
import { limitSiteRequest } from "@/lib/sites/activity/limitSiteRequest";
import { SiteError } from "@/lib/sites/SiteError";
import { acquisitionSchema } from "./schema";
import { getPlayerOAuthConfig } from "./getPlayerOAuthConfig";
import { verifyPlayerSession } from "./verifyPlayerSession";
import { signPlayerSession } from "./signPlayerSession";
import { requirePlayerSession } from "./requirePlayerSession";
/** No private artist/fan/owner fields are exposed in public configuration. */
export async function getPublicPlayer(id: string, input: unknown) {
  z.string().uuid().parse(id);
  const query = z
    .object({
      provider: z.enum(["spotify", "apple_music"]).optional(),
      parent: z.string().max(2048).default(""),
      flow: z.string().max(2048).optional(),
      ...acquisitionSchema.shape,
    })
    .strict()
    .parse(input);
  await limitSiteRequest(id, "player-config", 600);
  const player = await selectReleasePlayer(id);
  if (!player?.enabled) throw new SiteError(404, "Player not available");
  const oauth = getPlayerOAuthConfig();
  if (
    query.parent &&
    query.parent !== oauth.origin &&
    !player.allowed_origins.includes(query.parent)
  )
    throw new SiteError(403, "Website is not registered for this player");
  const result = {
    playerId: id,
    name: player.name,
    artwork: player.artwork,
    spotifyUrl: player.spotify_url,
    appleUrl: player.apple_url,
    revision: player.revision,
  };
  if (!query.provider) return result;
  const release = query.provider === "spotify" ? player.spotify_url : player.apple_url;
  if (!release) throw new SiteError(404, "Provider not available for this release");
  let flow = query.flow;
  if (flow) {
    const existing = await requirePlayerSession(flow);
    if (existing.player.id !== id || existing.session.provider !== query.provider)
      throw new SiteError(403, "Session belongs to another release or provider");
  } else {
    const expiresAt = Date.now() + 7200000,
      sessionId = randomUUID();
    await insertPlayerSession({
      id: sessionId,
      player_id: id,
      revision: player.revision,
      provider: query.provider,
      acquisition: acquisitionSchema.parse({
        source: query.source,
        medium: query.medium,
        campaign: query.campaign,
        content: query.content,
      }),
      expires_at: new Date(expiresAt).toISOString(),
    });
    flow = signPlayerSession({
      playerId: id,
      sessionId,
      revision: player.revision,
      origin: oauth.origin,
      expiresAt,
    });
  }
  return {
    ...result,
    provider: query.provider,
    release,
    flow,
    sessionId: verifyPlayerSession(flow).sessionId,
    spotify: {
      configured: !!oauth.clientId,
      clientId: oauth.clientId,
      redirectUri: oauth.redirectUri,
      scopes: oauth.scopes,
    },
  };
}
