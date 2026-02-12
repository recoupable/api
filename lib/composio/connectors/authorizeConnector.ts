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
 * Options for authorizing a connector.
 */
export interface AuthorizeConnectorOptions {
  /**
   * Custom auth configs for toolkits that require custom OAuth credentials.
   * e.g., { tiktok: "ac_xxxxx" }
   */
  authConfigs?: Record<string, string>;
  /**
   * Custom callback URL (overrides default).
   */
  customCallbackUrl?: string;
}

/**
 * Generate an OAuth authorization URL for a connector.
 *
 * @param accountId - The account ID to store the connection under
 * @param connector - The connector slug (e.g., "googlesheets", "tiktok")
 * @param options - Authorization options
 * @returns The redirect URL for OAuth
 */
export async function authorizeConnector(
  accountId: string,
  connector: string,
  options: AuthorizeConnectorOptions = {},
): Promise<AuthorizeResult> {
  const { authConfigs, customCallbackUrl } = options;
  const composio = await getComposioClient();

  // Determine callback URL
  const callbackUrl = customCallbackUrl ?? getCallbackUrl({ destination: "connectors" });

  // Create session with optional auth configs
  const session = await composio.create(accountId, {
    ...(authConfigs && Object.keys(authConfigs).length > 0 && { authConfigs }),
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
