import { selectYouTubeTokens } from "@/lib/supabase/youtube_tokens/selectYouTubeTokens";
import { isTokenExpired } from "@/lib/youtube/isTokenExpired";
import { refreshStoredYouTubeToken } from "@/lib/youtube/refreshStoredYouTubeToken";
import type { Tables } from "@/types/database.types";

export type YouTubeTokensRow = Tables<"youtube_tokens">;

/**
 * Validates the stored YouTube tokens for an artist account. If they are
 * expired (or near-expiry, 1-minute safety buffer) a refresh is attempted
 * automatically.
 *
 * Throws on every unusable case — no token row, expired with no refresh
 * token, DB error, or refresh failure. The single catch boundary lives in
 * `validateYouTubeChannelInfoRequest`, which collapses every failure into
 * one response shape.
 *
 * @param artist_account_id - The artist account ID.
 * @returns The validated tokens row.
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
