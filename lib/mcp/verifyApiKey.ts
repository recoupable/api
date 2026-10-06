import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { getOrCreateAccountIdByAuthToken } from "@/lib/privy/getOrCreateAccountIdByAuthToken";
import { getApiKeyDetails } from "@/lib/keys/getApiKeyDetails";
import { verifyOAuthBearer } from "@/lib/oauth/verifyOAuthBearer";
import type { OAuthAccess } from "@/lib/oauth/resolveOAuthAccess";

export interface McpAuthInfoExtra extends Record<string, unknown> {
  accountId: string;
  oauth?: OAuthAccess;
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
  try {
    const oauth = await verifyOAuthBearer(bearerToken);
    if (oauth)
      return {
        token: bearerToken,
        scopes: oauth.scopes,
        clientId: oauth.clientId,
        expiresAt: oauth.expiresAt,
        extra: { accountId: oauth.accountId, oauth },
      };
  } catch {
    // Storage failure never grants delegated access; legacy credentials still validate independently.
  }

  // Try Privy JWT first
  try {
    const accountId = await getOrCreateAccountIdByAuthToken(bearerToken);

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
