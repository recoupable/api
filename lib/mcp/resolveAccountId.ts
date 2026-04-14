import { canAccessAccount } from "@/lib/organizations/canAccessAccount";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";

export interface ResolveAccountIdParams {
  authInfo: McpAuthInfo | undefined;
  accountIdOverride: string | undefined;
}

export interface ResolveAccountIdResult {
  accountId: string | null;
  error: string | null;
}

/**
 * Resolve Account Id.
 *
 * @param root0 - Input object.
 * @param root0.authInfo - Value for root0.authInfo.
 * @param root0.accountIdOverride - Value for root0.accountIdOverride.
 * @returns - Computed result.
 */
export async function resolveAccountId({
  authInfo,
  accountIdOverride,
}: ResolveAccountIdParams): Promise<ResolveAccountIdResult> {
  const authAccountId = authInfo?.extra?.accountId;

  if (authAccountId) {
    // If account_id override is provided, validate access (for org API keys)
    if (accountIdOverride && accountIdOverride !== authAccountId) {
      const hasAccess = await canAccessAccount({
        currentAccountId: authAccountId,
        targetAccountId: accountIdOverride,
      });
      if (!hasAccess) {
        return { accountId: null, error: "Access denied to specified account_id" };
      }
      return { accountId: accountIdOverride, error: null };
    }
    return { accountId: authAccountId, error: null };
  }

  if (accountIdOverride) {
    return { accountId: accountIdOverride, error: null };
  }

  return {
    accountId: null,
    error:
      "Authentication required. Provide an API key via Authorization: Bearer header, or provide account_id from the system prompt context.",
  };
}
