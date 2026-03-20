import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { getAccountIdByAuthToken } from "@/lib/privy/getAccountIdByAuthToken";
import { getApiKeyDetails } from "@/lib/keys/getApiKeyDetails";

export interface McpAuthInfoExtra extends Record<string, unknown> {
  accountId: string;
}

export interface McpAuthInfo extends AuthInfo {
  extra: McpAuthInfoExtra;
}

/**
 * Verifies a bearer token (Privy JWT or API key) and returns auth info.
 *
 * Tries Privy JWT validation first, then falls back to API key validation.
 *
 * @param _req - The request object (unused).
 * @param bearerToken - The token from Authorization: Bearer header (Privy JWT or API key).
 * @returns AuthInfo with accountId, or undefined if invalid.
 */
export async function verifyBearerToken(
  _req: Request,
  bearerToken?: string,
): Promise<McpAuthInfo | undefined> {
  if (!bearerToken) {
    return undefined;
  }

  // Try Privy JWT first
  try {
    const accountId = await getAccountIdByAuthToken(bearerToken);

    return {
      token: bearerToken,
      scopes: ["mcp:tools"],
      clientId: accountId,
      extra: { accountId },
    };
  } catch {
    // Privy validation failed, try API key
  }

  // Try API key validation
  try {
    const keyDetails = await getApiKeyDetails(bearerToken);

    if (!keyDetails) {
      return undefined;
    }

    return {
      token: bearerToken,
      scopes: ["mcp:tools"],
      clientId: keyDetails.accountId,
      extra: { accountId: keyDetails.accountId },
    };
  } catch {
    return undefined;
  }
}
