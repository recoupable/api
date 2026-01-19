import { getConnectors } from "./getConnectors";

/**
 * Verifies that a connected account ID belongs to the specified user.
 *
 * Why: Before disconnecting a connector, we must verify ownership to prevent
 * users from disconnecting other users' connectors (authorization bypass).
 *
 * @param accountId - The authenticated user's account ID
 * @param connectedAccountId - The connected account ID to verify
 * @returns true if the connected account belongs to the user, false otherwise
 */
export async function verifyConnectorOwnership(
  accountId: string,
  connectedAccountId: string
): Promise<boolean> {
  const connectors = await getConnectors(accountId);

  // Check if any of the user's connectors have this connected account ID
  return connectors.some(
    (connector) => connector.connectedAccountId === connectedAccountId
  );
}
