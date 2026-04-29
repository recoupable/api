import { selectYouTubeTokens } from "@/lib/supabase/youtube_tokens/selectYouTubeTokens";
import { isTokenExpired } from "@/lib/youtube/isTokenExpired";
import { refreshStoredYouTubeToken } from "@/lib/youtube/refreshStoredYouTubeToken";
import type { Tables } from "@/types/database.types";

export type YouTubeTokensRow = Tables<"youtube_tokens">;

/**
 * Resolves the stored YouTube tokens for an artist, refreshing them if
 * they are expired (with a 1-minute safety buffer). Throws on every
 * unusable case — no row, expired with no refresh token, DB error, or
 * refresh failure — so a single catch in
 * `validateYouTubeChannelInfoRequest` can collapse them to one response.
 */
export async function validateYouTubeTokens(artist_account_id: string): Promise<YouTubeTokensRow> {
  const storedTokens = await selectYouTubeTokens(artist_account_id);

  if (!storedTokens) {
    throw new Error("youtube tokens not found");
  }

  if (isTokenExpired(storedTokens.expires_at)) {
    if (!storedTokens.refresh_token) {
      throw new Error("youtube tokens expired with no refresh_token");
    }
    return await refreshStoredYouTubeToken(storedTokens, artist_account_id);
  }

  return storedTokens;
}
