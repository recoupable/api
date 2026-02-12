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
   * Filter to only these toolkit slugs.
   * If not provided, returns all toolkits.
   */
  allowedToolkits?: readonly string[];
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
  const { allowedToolkits, displayNames = {} } = options;
  const composio = await getComposioClient();

  // Create session, optionally filtering to allowed toolkits
  const sessionOptions = allowedToolkits
    ? { toolkits: [...allowedToolkits] as string[] }
    : undefined;

  const session = await composio.create(accountId, sessionOptions);
  const toolkits = await session.toolkits();

  // Build connector list
  const connectors = toolkits.items.map(toolkit => ({
    slug: toolkit.slug,
    name: displayNames[toolkit.slug] || toolkit.name,
    isConnected: toolkit.connection?.isActive ?? false,
    connectedAccountId: toolkit.connection?.connectedAccount?.id,
  }));

  // If filtering, ensure we return all allowed toolkits (even if not in Composio response)
  if (allowedToolkits) {
    const existingSlugs = new Set(connectors.map(c => c.slug));
    for (const slug of allowedToolkits) {
      if (!existingSlugs.has(slug)) {
        connectors.push({
          slug,
          name: displayNames[slug] || slug,
          isConnected: false,
          connectedAccountId: undefined,
        });
      }
    }
    // Filter to only allowed and maintain order
    return allowedToolkits.map(slug => connectors.find(c => c.slug === slug)!);
  }

  return connectors;
}
