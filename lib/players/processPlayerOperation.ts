import { requirePlayerAudio } from "./requirePlayerAudio";
import { limitSiteRequest } from "@/lib/sites/activity/limitSiteRequest";
import { z } from "zod";
import { authorizeSiteWorkspace } from "@/lib/sites/authorizeSiteWorkspace";
import { selectArtistOrganizationIds } from "@/lib/supabase/artist_organization_ids/selectArtistOrganizationIds";
import { hasPaidSiteSubscription } from "@/lib/sites/fanConnection/hasPaidSiteSubscription";
import { insertReleasePlayer } from "@/lib/supabase/release_players/insertReleasePlayer";
import { selectReleasePlayer } from "@/lib/supabase/release_players/selectReleasePlayer";
import { selectReleasePlayers } from "@/lib/supabase/release_players/selectReleasePlayers";
import { updateReleasePlayer } from "@/lib/supabase/release_players/updateReleasePlayer";
import { SiteError } from "@/lib/sites/SiteError";
import { playerOperationSchemas, type PlayerOperation } from "./operationSchemas";
import { playerInputSchema } from "./schema";
import { getPlayerLinks } from "./getPlayerLinks";
/** Shared HTTP/MCP operation; identity always comes from authentication. */
export async function processPlayerOperation(
  accountId: string,
  operation: PlayerOperation,
  input: unknown,
) {
  const parsed = playerOperationSchemas[operation].parse(input);
  const owner = await authorizeSiteWorkspace(accountId, parsed.organizationId);
  await limitSiteRequest(owner, "player-management", 180);
  if (operation === "create") {
    const value = playerInputSchema.parse(input);
    const memberships = await selectArtistOrganizationIds(value.artistId);
    if (value.artistId !== owner && !memberships?.some(row => row.organization_id === owner))
      throw new SiteError(403, "Artist is outside this workspace");
    if (value.enabled && !(await hasPaidSiteSubscription(owner)))
      throw new SiteError(
        402,
        "An active paid Recoup subscription is required to publish a player",
      );
    await requirePlayerAudio(owner, value.audioUrl);
    const player = await insertReleasePlayer({
      owner_id: owner,
      created_by: accountId,
      artist_id: value.artistId,
      name: value.name,
      spotify_url: value.spotifyUrl,
      apple_url: value.appleUrl,
      allowed_origins: value.allowedOrigins,
      enabled: value.enabled,
      free_playback: value.freePlayback,
      audio_url: value.audioUrl,
      artwork: value.artwork,
    });
    return { player, ...getPlayerLinks(player.id) };
  }
  if (operation === "list") {
    const pagination = playerOperationSchemas.list.parse(input);
    const players = await selectReleasePlayers(owner, pagination.offset, pagination.limit);
    return {
      players,
      offset: pagination.offset,
      limit: pagination.limit,
      nextOffset: players.length === pagination.limit ? pagination.offset + pagination.limit : null,
    };
  }
  const id = z.object({ id: z.string().uuid() }).parse(input).id;
  const player = await selectReleasePlayer(id);
  if (!player || player.owner_id !== owner) throw new SiteError(404, "Player not found");
  if (operation === "get") return { player, ...getPlayerLinks(player.id) };
  const update = playerOperationSchemas.update.parse(input);
  if (player.revision !== update.revision)
    throw new SiteError(409, "Player changed; read the latest revision");
  if ((update.enabled ?? player.enabled) && !(await hasPaidSiteSubscription(owner)))
    throw new SiteError(402, "An active paid Recoup subscription is required to publish a player");
  const value = playerInputSchema.parse({
    artistId: player.artist_id,
    name: update.name ?? player.name,
    spotifyUrl: update.spotifyUrl === undefined ? player.spotify_url : update.spotifyUrl,
    appleUrl: update.appleUrl === undefined ? player.apple_url : update.appleUrl,
    allowedOrigins: update.allowedOrigins ?? player.allowed_origins,
    artwork: update.artwork === undefined ? player.artwork : update.artwork,
    enabled: update.enabled ?? player.enabled,
    freePlayback: update.freePlayback ?? player.free_playback ?? "spotify",
    audioUrl: update.audioUrl === undefined ? (player.audio_url ?? null) : update.audioUrl,
  });
  if (
    update.audioUrl !== undefined ||
    (value.freePlayback === "audio" && (update.freePlayback === "audio" || update.enabled === true))
  )
    await requirePlayerAudio(owner, value.audioUrl);
  const saved = await updateReleasePlayer(id, owner, update.revision, {
    name: value.name,
    spotify_url: value.spotifyUrl,
    apple_url: value.appleUrl,
    allowed_origins: value.allowedOrigins,
    artwork: value.artwork,
    enabled: value.enabled,
    free_playback: value.freePlayback,
    audio_url: value.audioUrl,
  });
  if (!saved) throw new SiteError(409, "Player changed; read the latest revision");
  return { player: saved, ...getPlayerLinks(id) };
}
