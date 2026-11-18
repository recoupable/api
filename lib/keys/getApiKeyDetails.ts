import { getAccountIdByApiKey } from "@/lib/auth/getAccountIdByApiKey";

export interface ApiKeyDetails {
  accountId: string;
}

/**
 * Retrieves the account ID using the shared API-key lookup and expiry policy.
 *
 * All API keys are personal — they resolve to the account that created them.
 * Org access is determined at access-check time via account memberships.
 *
 * @param apiKey - The raw API key string
 * @returns ApiKeyDetails with accountId, or null if key is invalid
 */
export async function getApiKeyDetails(apiKey: string): Promise<ApiKeyDetails | null> {
  if (!apiKey) {
    return null;
  }

  try {
    const accountId = await getAccountIdByApiKey(apiKey);
    if (!accountId) return null;

    return { accountId };
  } catch (error) {
    console.error("[ERROR] getApiKeyDetails:", error);
    return null;
  }
}
