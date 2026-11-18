import { getPlayerCapabilities } from "./getPlayerCapabilities";
import { getPlayerLinks } from "./getPlayerLinks";
import type { ReleasePlayer } from "./schema";

/** Project the player only after the caller has verified workspace ownership. */
export function getPlayerReadResponse(player: ReleasePlayer) {
  return {
    player,
    ...getPlayerLinks(player.id),
    capabilities: getPlayerCapabilities(player.spotify_url),
  };
}
