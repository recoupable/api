import { hashApiKey } from "@/lib/keys/hashApiKey";
import { isApiKeyExpired } from "@/lib/keys/isApiKeyExpired";
import { PRIVY_PROJECT_SECRET } from "@/lib/const";
import { selectAccountApiKeys } from "@/lib/supabase/account_api_keys/selectAccountApiKeys";

/**
 * Resolve the account id for a raw Recoup API key (`recoup_sk_…`), or `null`
 * when the key is unknown, the lookup fails, or the key is past its `expires_at`
 * TTL (ephemeral keys — chat#1813).
 *
 * Shared by both auth entry points so a `recoup_sk_` key authenticates the same
 * way whether it arrives as `x-api-key` (`getApiKeyAccountId`) or as
 * `Authorization: Bearer` (`getAuthenticatedAccountId`).
 *
 * @param apiKey - The raw API key string.
 */
export async function getAccountIdByApiKey(apiKey: string): Promise<string | null> {
  const keyHash = hashApiKey(apiKey, PRIVY_PROJECT_SECRET);
  const apiKeys = await selectAccountApiKeys({ keyHash });

  if (apiKeys === null) {
    console.error("[ERROR] selectAccountApiKeys returned null");
    return null;
  }

  const matched = apiKeys[0];
  const accountId = matched?.account ?? null;

  // Reject an unknown key, or an ephemeral key past its TTL.
  if (!accountId || isApiKeyExpired(matched?.expires_at)) {
    return null;
  }

  return accountId;
}
