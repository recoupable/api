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
 * All toolkit slugs the platform supports.
 * Passed explicitly to composio.create() because session.toolkits()
 * only returns the first 20 by default.
 */
const SUPPORTED_TOOLKITS = [
  "googlesheets",
  "googledrive",
  "googledocs",
  "tiktok",
];

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

  const session = await composio.create(accountId, {
    toolkits: SUPPORTED_TOOLKITS,
  });
  const toolkits = await session.toolkits();

  return toolkits.items.map(toolkit => {
    const slug = toolkit.slug.toLowerCase();
    return {
      slug,
      name: displayNames[slug] || toolkit.name,
      isConnected: toolkit.connection?.isActive ?? false,
      connectedAccountId: toolkit.connection?.connectedAccount?.id,
    };
  });
}
