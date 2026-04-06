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
const SUPPORTED_TOOLKITS = ["googlesheets", "googledrive", "googledocs", "tiktok", "instagram"];

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
 * Build auth configs from environment variables.
 * Must match the configs used during authorization so Composio
 * can find connections created with custom OAuth credentials.
 */
function buildAuthConfigs(): Record<string, string> | undefined {
  const configs: Record<string, string> = {};
  if (process.env.COMPOSIO_TIKTOK_AUTH_CONFIG_ID) {
    configs.tiktok = process.env.COMPOSIO_TIKTOK_AUTH_CONFIG_ID;
  }
  if (process.env.COMPOSIO_INSTAGRAM_AUTH_CONFIG_ID) {
    configs.instagram = process.env.COMPOSIO_INSTAGRAM_AUTH_CONFIG_ID;
  }
  return Object.keys(configs).length > 0 ? configs : undefined;
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

  const authConfigs = buildAuthConfigs();
  const session = await composio.create(accountId, {
    toolkits: SUPPORTED_TOOLKITS,
    ...(authConfigs && { authConfigs }),
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
