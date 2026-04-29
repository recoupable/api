import { createYouTubeOAuthClient } from "@/lib/youtube/oauth-client";
import { upsertYouTubeTokens } from "@/lib/supabase/youtube_tokens/upsertYouTubeTokens";
import type { Tables } from "@/types/database.types";

export type YouTubeTokensRow = Tables<"youtube_tokens">;

/**
 * Refreshes an expired YouTube access token using the stored refresh token,
 * then persists the new credentials. Mirrors chat's behaviour 1:1.
 *
 * Any failure (missing refresh token, Google rejection, db update failure)
 * logs via `console.error` and returns `null`. The handler collapses every
 * null return into the same `{ tokenStatus: "invalid" }` response, so a
 * typed error code carried no information out.
 *
 * @param storedTokens - The currently stored token row (must include refresh_token).
 * @param artist_account_id - Artist account ID, used for log context.
 * @returns The refreshed tokens row, or `null` on any failure.
 */
export async function refreshStoredYouTubeToken(
  storedTokens: YouTubeTokensRow,
  artist_account_id: string,
): Promise<YouTubeTokensRow | null> {
  if (!storedTokens.refresh_token) {
    console.error(`No refresh token available for token refresh (account ${artist_account_id})`);
    return null;
  }

  console.log(`Access token for account ${artist_account_id} expired. Attempting refresh.`);

  try {
    const oauth2Client = createYouTubeOAuthClient();
    oauth2Client.setCredentials({ refresh_token: storedTokens.refresh_token });

    const { credentials } = await oauth2Client.refreshAccessToken();
    console.log(`Successfully refreshed token for account ${artist_account_id}`);

    if (!credentials.access_token || !credentials.expiry_date) {
      console.error("Refresh token response missing access_token or expiry_date", credentials);
      return null;
    }

    const newExpiresAt = new Date(credentials.expiry_date).toISOString();
    const updatedTokensData: YouTubeTokensRow = {
      ...storedTokens,
      access_token: credentials.access_token,
      expires_at: newExpiresAt,
    };

    const updateResult = await upsertYouTubeTokens(updatedTokensData);

    if (!updateResult) {
      console.error(`Failed to update refreshed tokens in DB for account ${artist_account_id}`);
      return null;
    }

    console.log(`Successfully updated tokens in DB for account ${artist_account_id}`);
    return updateResult;
  } catch (refreshError: unknown) {
    console.error(`Error refreshing YouTube token for account ${artist_account_id}:`, refreshError);

    if (
      refreshError &&
      typeof refreshError === "object" &&
      "response" in refreshError &&
      refreshError.response &&
      typeof refreshError.response === "object" &&
      "data" in refreshError.response &&
      refreshError.response.data &&
      typeof refreshError.response.data === "object" &&
      "error" in refreshError.response.data &&
      refreshError.response.data.error === "invalid_grant"
    ) {
      console.error(`YouTube refresh token is invalid or revoked for account ${artist_account_id}`);
    }

    return null;
  }
}
