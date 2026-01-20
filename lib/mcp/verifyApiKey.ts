import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { getAccountIdByAuthToken } from "@/lib/privy/getAccountIdByAuthToken";
import { getAccountIdByApiKey } from "@/lib/mcp/getAccountIdByApiKey";

export interface McpAuthInfoExtra extends Record<string, unknown> {
  accountId: string;
  orgId: string | null;
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
      extra: {
        accountId,
        orgId: null,
      },
    };
  } catch {
    // Privy validation failed, try API key
  }

  // Try API key validation
  try {
    const accountId = await getAccountIdByApiKey(bearerToken);

    if (!accountId) {
      return undefined;
    }

    return {
      token: bearerToken,
      scopes: ["mcp:tools"],
      clientId: accountId,
      extra: {
        accountId,
        orgId: null,
      },
    };
  } catch {
    return undefined;
  }
}
