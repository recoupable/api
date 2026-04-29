import { selectYouTubeTokens } from "@/lib/supabase/youtube_tokens/selectYouTubeTokens";
import { isTokenExpired } from "@/lib/youtube/isTokenExpired";
import { refreshStoredYouTubeToken } from "@/lib/youtube/refreshStoredYouTubeToken";
import type { Tables } from "@/types/database.types";

export type YouTubeTokensRow = Tables<"youtube_tokens">;

/**
 * Validates the stored YouTube tokens for an artist account. If they are
 * expired (or near-expiry, 1-minute safety buffer) a refresh is attempted
 * automatically. Mirrors chat's `validateYouTubeTokens` 1:1.
 *
 * Returns `null` ONLY for the legitimate "tokens not usable, user needs to
 * (re-)auth" cases: no token row exists, or the row is expired and has no
 * refresh_token. These are normal user states, not errors.
 *
 * Throws for actual errors (DB query failure, refresh failure). The single
 * catch boundary lives in `validateYouTubeChannelInfoRequest`.
 *
 * @param artist_account_id - The artist account ID.
 * @returns The validated tokens row, or `null` when the user needs to (re-)auth.
 */
export async function validateYouTubeTokens(
  artist_account_id: string,
): Promise<YouTubeTokensRow | null> {
  const storedTokens = await selectYouTubeTokens(artist_account_id);

  if (!storedTokens) {
    return null;
  }

  if (isTokenExpired(storedTokens.expires_at)) {
    if (storedTokens.refresh_token) {
      return await refreshStoredYouTubeToken(storedTokens, artist_account_id);
    }
    return null;
  }

  return storedTokens;
}
