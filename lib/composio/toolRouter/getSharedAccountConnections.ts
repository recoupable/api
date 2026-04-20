import { getConnectors } from "../connectors/getConnectors";

/**
 * Google toolkits that the shared account can provide access for.
 */
const SHARED_GOOGLE_TOOLKITS = new Set(["googledrive", "googlesheets", "googledocs"]);

/**
 * Composio account ID for the shared Recoupable Google account.
 * Used across Google Drive, Sheets, and Docs.
 */
const SHARED_ACCOUNT_ID = "recoup-shared-767f498e-e1e9-43c6-a152-a96ae3bd8d07";

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
  try {
    const connectors = await getConnectors(SHARED_ACCOUNT_ID);

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

    console.info("[getSharedAccountConnections] resolved", {
      sharedAccountId: SHARED_ACCOUNT_ID,
      totalConnectors: connectors.length,
      connectorSlugs: connectors.map(c => ({ slug: c.slug, isConnected: c.isConnected })),
      resolvedSlugs: Object.keys(connections),
    });

    return connections;
  } catch (error) {
    // Never let a shared-account lookup failure take down the entire
    // tool router — the rest of the session (account + artist connections
    // + Composio meta-tools) must still work. Log loudly so we can fix it.
    console.error("[getSharedAccountConnections] failed — returning no shared connections", {
      sharedAccountId: SHARED_ACCOUNT_ID,
      error: error instanceof Error ? error.message : String(error),
    });
    return {};
  }
}
