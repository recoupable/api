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
 * Resolves the accountId from MCP auth info or an override parameter.
 * Validates access when an org API key attempts to use an account_id override.
 *
 * @param params - The auth info and optional account_id override.
 * @param params.authInfo
 * @param params.accountIdOverride
 * @returns The resolved accountId or an error message.
 */
export async function resolveAccountId({
  authInfo,
  accountIdOverride,
}: ResolveAccountIdParams): Promise<ResolveAccountIdResult> {
  const authAccountId = authInfo?.extra?.accountId;
  const authOrgId = authInfo?.extra?.orgId;

  if (authAccountId) {
    // If account_id override is provided, validate access (for org API keys)
    if (accountIdOverride && accountIdOverride !== authAccountId) {
      const hasAccess = await canAccessAccount({
        orgId: authOrgId,
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
