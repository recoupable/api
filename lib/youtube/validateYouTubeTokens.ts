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
 * Failures (no row, expired without refresh, refresh failure, db error)
 * log via `console.error` and return `null`. Callers collapse every
 * null return into the same `{ tokenStatus: "invalid" }` response, so
 * the discriminated error code carried no information out.
 *
 * @param artist_account_id - The artist account ID.
 * @returns The validated tokens row, or `null` on any failure.
 */
export async function validateYouTubeTokens(
  artist_account_id: string,
): Promise<YouTubeTokensRow | null> {
  try {
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
  } catch (error) {
    console.error("Error validating YouTube tokens:", error);
    return null;
  }
}
