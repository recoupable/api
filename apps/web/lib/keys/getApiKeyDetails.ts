import { hashApiKey } from "@/lib/keys/hashApiKey";
import { PRIVY_PROJECT_SECRET } from "@/lib/const";
import { selectAccountApiKeys } from "@/lib/supabase/account_api_keys/selectAccountApiKeys";

export interface ApiKeyDetails {
  accountId: string;
}

/**
 * Retrieves the account ID for an API key.
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
    const keyHash = hashApiKey(apiKey, PRIVY_PROJECT_SECRET);
    const apiKeys = await selectAccountApiKeys({ keyHash });

    if (apiKeys === null || apiKeys.length === 0) {
      return null;
    }

    const accountId = apiKeys[0]?.account ?? null;

    if (!accountId) {
      return null;
    }

    return { accountId };
  } catch (error) {
    console.error("[ERROR] getApiKeyDetails:", error);
    return null;
  }
}
