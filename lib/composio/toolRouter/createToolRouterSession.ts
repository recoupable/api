import { getComposioClient } from "../client";
import { getCallbackUrl } from "../getCallbackUrl";
import { getConnectors } from "../connectors/getConnectors";

/**
 * Toolkits available in Tool Router sessions.
 * Add more toolkits here as we expand Composio integration.
 */
const ENABLED_TOOLKITS = ["googlesheets", "googledrive", "googledocs", "tiktok"];

/**
 * Create Tool Router Session.
 *
 * @param accountId - Account identifier.
 * @param roomId - Room identifier.
 * @param artistConnections - Value for artistConnections.
 * @returns - Computed result.
 */
export async function createToolRouterSession(
  accountId: string,
  roomId?: string,
  artistConnections?: Record<string, string>,
) {
  const composio = await getComposioClient();

  const callbackUrl = getCallbackUrl({
    destination: "chat",
    roomId,
  });

  // Filter artist connections to prevent tool collision.
  // If the account already has a toolkit connected, the account's connection wins.
  // Artist connections only override toolkits the account hasn't connected.
  let filteredConnections = artistConnections;

  if (artistConnections && Object.keys(artistConnections).length > 0) {
    const accountConnectors = await getConnectors(accountId);

    // Find which toolkits the account already has active connections for
    const accountConnectedSlugs = new Set(
      accountConnectors.filter(c => c.isConnected).map(c => c.slug),
    );

    // Only keep artist connections for toolkits the account doesn't have
    filteredConnections = Object.fromEntries(
      Object.entries(artistConnections).filter(([slug]) => !accountConnectedSlugs.has(slug)),
    );

    // If nothing left after filtering, don't pass overrides at all
    if (Object.keys(filteredConnections).length === 0) {
      filteredConnections = undefined;
    }
  }

  const session = await composio.create(accountId, {
    toolkits: ENABLED_TOOLKITS,
    manageConnections: {
      callbackUrl,
    },
    connectedAccounts: filteredConnections,
  });

  return session;
}
