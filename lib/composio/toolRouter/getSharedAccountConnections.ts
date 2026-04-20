import { getConnectors } from "../connectors/getConnectors";

/**
 * Google toolkits that the shared account can provide access for.
 */
const SHARED_GOOGLE_TOOLKITS = new Set(["googledrive", "googlesheets", "googledocs"]);

/**
 * Default Composio entity ID for the shared Google account.
 * Override with COMPOSIO_SHARED_ENTITY_ID env var.
 */
const DEFAULT_SHARED_ENTITY = "shared@recoupable.com";

/**
 * Get Google Drive/Sheets/Docs connections from the shared Recoupable account.
 *
 * When a customer doesn't want to grant full Google Drive access,
 * they can share specific files with shared@recoupable.com instead.
 * This function fetches the shared account's connections so they
 * can be used as a fallback in tool router sessions.
 *
 * @returns Map of Google toolkit slug to connected account ID
 */
export async function getSharedAccountConnections(): Promise<Record<string, string>> {
  const entityId = process.env.COMPOSIO_SHARED_ENTITY_ID || DEFAULT_SHARED_ENTITY;
  const connectors = await getConnectors(entityId);

  const connections: Record<string, string> = {};
  for (const connector of connectors) {
    if (
      SHARED_GOOGLE_TOOLKITS.has(connector.slug) &&
      connector.isConnected &&
      connector.connectedAccountId
    ) {
      connections[connector.slug] = connector.connectedAccountId;
    }
  }

  return connections;
}
