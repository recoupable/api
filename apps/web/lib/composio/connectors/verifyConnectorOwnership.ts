import { getConnectors } from "./getConnectors";

/**
 * Verifies that a connected account ID belongs to the specified account.
 *
 * Why: Before disconnecting a connector, we must verify ownership to prevent
 * accounts from disconnecting other accounts' connectors (authorization bypass).
 *
 * @param accountId - The authenticated account ID
 * @param connectedAccountId - The connected account ID to verify
 * @returns true if the connected account belongs to this account, false otherwise
 */
export async function verifyConnectorOwnership(
  accountId: string,
  connectedAccountId: string,
): Promise<boolean> {
  const connectors = await getConnectors(accountId);

  // Check if any of the account's connectors have this connected account ID
  return connectors.some(connector => connector.connectedAccountId === connectedAccountId);
}
