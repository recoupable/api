import { getComposioClient } from "../client";

/**
 * Connector info returned by Composio.
 */
export interface ConnectorInfo {
  slug: string;
  name: string;
  isConnected: boolean;
  connectedAccountId?: string;
}

/**
 * Options for getting connectors.
 */
export interface GetConnectorsOptions {
  /**
   * Custom display names for toolkits.
   * e.g., { tiktok: "TikTok" }
   */
  displayNames?: Record<string, string>;
}

/**
 * Get connectors and their connection status for an account.
 *
 * Works for any account ID. Composio uses the accountId to scope connections.
 *
 * @param accountId - The account ID to get connectors for
 * @param options - Options for filtering and display
 * @returns List of connectors with connection status
 */
export async function getConnectors(
  accountId: string,
  options: GetConnectorsOptions = {},
): Promise<ConnectorInfo[]> {
  const { displayNames = {} } = options;
  const composio = await getComposioClient();

  const session = await composio.create(accountId);
  const toolkits = await session.toolkits();

  return toolkits.items.map(toolkit => ({
    slug: toolkit.slug,
    name: displayNames[toolkit.slug] || toolkit.name,
    isConnected: toolkit.connection?.isActive ?? false,
    connectedAccountId: toolkit.connection?.connectedAccount?.id,
  }));
}
