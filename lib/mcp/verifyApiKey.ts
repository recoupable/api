import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { getApiKeyDetails } from "@/lib/keys/getApiKeyDetails";

export interface McpAuthInfoExtra extends Record<string, unknown> {
  accountId: string;
  orgId: string | null;
}

export interface McpAuthInfo extends AuthInfo {
  extra: McpAuthInfoExtra;
}

/**
 * Verifies an API key and returns auth info with account details.
 *
 * @param _req - The request object (unused).
 * @param bearerToken - The API key from the Authorization: Bearer header.
 * @returns AuthInfo with accountId and orgId, or undefined if invalid.
 */
export async function verifyApiKey(
  _req: Request,
  bearerToken?: string,
): Promise<McpAuthInfo | undefined> {
  if (!bearerToken) {
    return undefined;
  }

  const apiKey = bearerToken;

  const keyDetails = await getApiKeyDetails(apiKey);

  if (!keyDetails) {
    return undefined;
  }

  return {
    token: apiKey,
    scopes: ["mcp:tools"],
    clientId: keyDetails.accountId,
    extra: {
      accountId: keyDetails.accountId,
      orgId: keyDetails.orgId,
    },
  };
}
