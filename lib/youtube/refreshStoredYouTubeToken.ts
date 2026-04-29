import { createYouTubeOAuthClient } from "@/lib/youtube/oauth-client";
import { upsertYouTubeTokens } from "@/lib/supabase/youtube_tokens/upsertYouTubeTokens";
import type { Tables } from "@/types/database.types";

/**
 * Refreshes an expired YouTube access token via the stored refresh token
 * and persists the new credentials. Throws on every failure (missing
 * refresh token, Google rejection, db update failure).
 */
export async function refreshStoredYouTubeToken(
  storedTokens: Tables<"youtube_tokens">,
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

    const updateResult = await upsertYouTubeTokens({
      ...storedTokens,
      access_token: credentials.access_token,
      expires_at: new Date(credentials.expiry_date).toISOString(),
    });

    if (!updateResult) {
      throw new Error(`Failed to update refreshed tokens in DB for account ${artist_account_id}`);
    }

    return updateResult;
  } catch (refreshError) {
    console.error(`Error refreshing YouTube token for account ${artist_account_id}:`, refreshError);
    throw refreshError;
  }
}
