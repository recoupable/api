import { selectYouTubeTokens } from "@/lib/supabase/youtube_tokens/selectYouTubeTokens";
import { isTokenExpired } from "@/lib/youtube/isTokenExpired";
import { refreshStoredYouTubeToken } from "@/lib/youtube/refreshStoredYouTubeToken";
import {
  buildYouTubeUtilityError,
  YouTubeErrorMessages,
  type YouTubeUtilityError,
} from "@/lib/youtube/youtubeErrors";
import type { Tables } from "@/types/database.types";

export type YouTubeTokensRow = Tables<"youtube_tokens">;

export type YouTubeTokenValidationResult =
  | { success: true; tokens: YouTubeTokensRow }
  | YouTubeUtilityError;

/**
 * Validates the stored YouTube tokens for an artist account. If they are
 * expired (or near-expiry, 1-minute safety buffer) a refresh is attempted
 * automatically. Mirrors chat's `validateYouTubeTokens` 1:1.
 *
 * @param artist_account_id - The artist account ID.
 * @returns The validated tokens or a coded error.
 */
export async function validateYouTubeTokens(
  artist_account_id: string,
): Promise<YouTubeTokenValidationResult> {
  try {
    const storedTokens = await selectYouTubeTokens(artist_account_id);

    if (!storedTokens) {
      return buildYouTubeUtilityError("NO_TOKENS", YouTubeErrorMessages.NO_TOKENS);
    }

    if (isTokenExpired(storedTokens.expires_at)) {
      if (storedTokens.refresh_token) {
        const refreshResult = await refreshStoredYouTubeToken(storedTokens, artist_account_id);
        if (refreshResult.success) {
          return { success: true, tokens: refreshResult.tokens };
        }
        return refreshResult;
      }
      return buildYouTubeUtilityError(
        "EXPIRED_NO_REFRESH",
        YouTubeErrorMessages.EXPIRED_TOKENS_NO_REFRESH,
      );
    }

    return { success: true, tokens: storedTokens };
  } catch (error) {
    console.error("Error validating YouTube tokens:", error);
    return buildYouTubeUtilityError("FETCH_ERROR", YouTubeErrorMessages.FETCH_ERROR);
  }
}
