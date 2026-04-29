import { createYouTubeOAuthClient } from "@/lib/youtube/oauth-client";
import { upsertYouTubeTokens } from "@/lib/supabase/youtube_tokens/upsertYouTubeTokens";
import type { Tables } from "@/types/database.types";

export type YouTubeTokensRow = Tables<"youtube_tokens">;

/**
 * Refreshes an expired YouTube access token using the stored refresh token,
 * then persists the new credentials. Mirrors chat's behaviour 1:1.
 *
 * Throws on every failure (missing refresh token, Google rejection, db
 * update failure). The single catch boundary lives in
 * `validateYouTubeChannelInfoRequest`, which collapses thrown errors into
 * the same `{ tokenStatus: "invalid" }` response as the no-tokens case.
 *
 * @param storedTokens - The currently stored token row (must include refresh_token).
 * @param artist_account_id - Artist account ID, used for log context.
 * @returns The refreshed tokens row.
 */
export async function refreshStoredYouTubeToken(
  storedTokens: YouTubeTokensRow,
  artist_account_id: string,
) {
  if (!storedTokens.refresh_token) {
    throw new Error(`No refresh token available for token refresh (account ${artist_account_id})`);
  }

  try {
    const oauth2Client = createYouTubeOAuthClient();
    oauth2Client.setCredentials({ refresh_token: storedTokens.refresh_token });

    const { credentials } = await oauth2Client.refreshAccessToken();

    if (!credentials.access_token || !credentials.expiry_date) {
      throw new Error(
        `Refresh token response missing access_token or expiry_date for account ${artist_account_id}`,
      );
    }

    const newExpiresAt = new Date(credentials.expiry_date).toISOString();
    const updatedTokensData: YouTubeTokensRow = {
      ...storedTokens,
      access_token: credentials.access_token,
      expires_at: newExpiresAt,
    };

    const updateResult = await upsertYouTubeTokens(updatedTokensData);

    if (!updateResult) {
      throw new Error(`Failed to update refreshed tokens in DB for account ${artist_account_id}`);
    }

    return updateResult;
  } catch (refreshError) {
    console.error(`Error refreshing YouTube token for account ${artist_account_id}:`, refreshError);
    throw refreshError;
  }
}
