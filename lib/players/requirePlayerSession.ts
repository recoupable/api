import { verifyPlayerSession } from "./verifyPlayerSession";
import { selectReleasePlayer } from "@/lib/supabase/release_players/selectReleasePlayer";
import { selectPlayerSession } from "@/lib/supabase/player_sessions/selectPlayerSession";
import { getPlayerOAuthConfig } from "./getPlayerOAuthConfig";
import { SiteError } from "@/lib/sites/SiteError";
export async function requirePlayerSession(token: string) {
  const context = (() => {
    try {
      return verifyPlayerSession(token);
    } catch {
      throw new SiteError(403, "Invalid or expired player session");
    }
  })();
  if (context.origin !== getPlayerOAuthConfig().origin)
    throw new SiteError(403, "Invalid player origin");
  const [player, session] = await Promise.all([
    selectReleasePlayer(context.playerId),
    selectPlayerSession(context.sessionId),
  ]);
  if (
    !player?.enabled ||
    !session ||
    player.revision !== context.revision ||
    session.player_id !== player.id ||
    session.revision !== context.revision ||
    new Date(session.expires_at).getTime() <= Date.now()
  )
    throw new SiteError(403, "Listening session expired or player changed");
  return { context, player, session };
}
