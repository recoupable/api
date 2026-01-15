import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { getApiKeyDetails } from "@/lib/keys/getApiKeyDetails";

/**
 * Verifies an API key and returns auth info with account details.
 *
 * @param req - The request object.
 * @param bearerToken - The bearer token from the Authorization header.
 * @returns AuthInfo with accountId and orgId, or undefined if invalid.
 */
export async function verifyApiKey(
  req: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> {
  // Try Authorization header first, then x-api-key header
  const apiKey = bearerToken || req.headers.get("x-api-key");

  if (!apiKey) {
    return undefined;
  }

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
