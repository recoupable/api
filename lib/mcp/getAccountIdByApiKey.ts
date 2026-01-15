import { hashApiKey } from "@/lib/keys/hashApiKey";
import { PRIVY_PROJECT_SECRET } from "@/lib/const";
import { selectAccountApiKeys } from "@/lib/supabase/account_api_keys/selectAccountApiKeys";

/**
 * Validates an API key and returns the associated account ID.
 *
 * @param apiKey - The raw API key to validate.
 * @returns The account ID if valid, or null if invalid.
 */
export async function getAccountIdByApiKey(
  apiKey: string,
): Promise<string | null> {
  const keyHash = hashApiKey(apiKey, PRIVY_PROJECT_SECRET);
  const apiKeys = await selectAccountApiKeys({ keyHash });

  if (!apiKeys || apiKeys.length === 0) {
    return null;
  }

  return apiKeys[0]?.account ?? null;
}
