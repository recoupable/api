import { getComposioClient } from "../client";
import { getCallbackUrl } from "../getCallbackUrl";

/**
 * Result of authorizing a connector.
 */
export interface AuthorizeResult {
  connector: string;
  redirectUrl: string;
}

/**
 * Generate an OAuth authorization URL for a connector.
 *
 * Why: Used by the /api/connectors/authorize endpoint to let users
 * connect from the settings page (not in-chat).
 *
 * @param userId - The user's account ID
 * @param connector - The connector slug (e.g., "googlesheets", "gmail")
 * @param customCallbackUrl - Optional custom callback URL after OAuth
 * @returns The redirect URL for OAuth
 */
export async function authorizeConnector(
  userId: string,
  connector: string,
  customCallbackUrl?: string,
): Promise<AuthorizeResult> {
  const composio = getComposioClient();

  const callbackUrl =
    customCallbackUrl || getCallbackUrl({ destination: "connectors" });

  const session = await composio.create(userId, {
    manageConnections: {
      callbackUrl,
    },
  });

  const connectionRequest = await session.authorize(connector);

  return {
    connector,
    redirectUrl: connectionRequest.redirectUrl,
  };
}
