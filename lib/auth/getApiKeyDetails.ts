import { hashApiKey } from "@/lib/keys/hashApiKey";
import { PRIVY_PROJECT_SECRET } from "@/lib/const";
import { selectAccountApiKeys } from "@/lib/supabase/account_api_keys/selectAccountApiKeys";
import { isOrganization } from "@/lib/supabase/account_organization_ids/isOrganization";

export interface ApiKeyDetails {
  accountId: string;
  orgId: string | null;
}

/**
 * Retrieves details for an API key including the account ID and organization context.
 *
 * For organization API keys, orgId will be set to the organization's account ID.
 * For personal API keys, orgId will be null.
 *
 * @param apiKey - The raw API key string
 * @returns ApiKeyDetails object with accountId and orgId, or null if key is invalid
 */
export async function getApiKeyDetails(
  apiKey: string,
): Promise<ApiKeyDetails | null> {
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

    // Check if this account is an organization
    const isOrg = await isOrganization(accountId);
    const orgId = isOrg ? accountId : null;

    return {
      accountId,
      orgId,
    };
  } catch (error) {
    console.error("[ERROR] getApiKeyDetails:", error);
    return null;
  }
}
