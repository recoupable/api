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
    console.error("[MCP Auth] No bearer token provided");
    return undefined;
  }

  // Try Privy JWT first
  try {
    const accountId = await getAccountIdByAuthToken(bearerToken);

    console.log("[MCP Auth] Privy JWT validated, accountId:", accountId);
    return {
      token: bearerToken,
      scopes: ["mcp:tools"],
      clientId: accountId,
      extra: {
        accountId,
        orgId: null,
      },
    };
  } catch (privyError) {
    console.log("[MCP Auth] Privy JWT validation failed:", privyError instanceof Error ? privyError.message : privyError);
  }

  // Try API key validation
  try {
    const accountId = await getAccountIdByApiKey(bearerToken);

    if (!accountId) {
      console.error("[MCP Auth] API key validation returned no accountId");
      return undefined;
    }

    console.log("[MCP Auth] API key validated, accountId:", accountId);
    return {
      token: bearerToken,
      scopes: ["mcp:tools"],
      clientId: accountId,
      extra: {
        accountId,
        orgId: null,
      },
    };
  } catch (apiKeyError) {
    console.error("[MCP Auth] API key validation failed:", apiKeyError instanceof Error ? apiKeyError.message : apiKeyError);
    return undefined;
  }
}
