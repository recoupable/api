import { getComposioApiKey } from "../getComposioApiKey";
import { getConnectors } from "./getConnectors";

/**
 * Options for disconnecting a connector.
 */
export interface DisconnectConnectorOptions {
  /**
   * Account ID to verify ownership before disconnecting.
   * If provided, checks that the connected account belongs to this account.
   */
  verifyOwnershipFor?: string;
}

/**
 * Disconnect a connected account from Composio.
 *
 * Why: Composio's Tool Router SDK doesn't expose a disconnect method,
 * so we call the REST API directly to delete the connection.
 *
 * @param connectedAccountId - The ID of the connected account to disconnect
 * @param options - Options for ownership verification
 * @returns Success status
 */
export async function disconnectConnector(
  connectedAccountId: string,
  options: DisconnectConnectorOptions = {},
): Promise<{ success: boolean }> {
  const { verifyOwnershipFor } = options;

  // If ownership verification is requested, check before deleting
  if (verifyOwnershipFor) {
    const connectors = await getConnectors(verifyOwnershipFor);
    const hasConnection = connectors.some(c => c.connectedAccountId === connectedAccountId);
    if (!hasConnection) {
      throw new Error("Connection not found for this account");
    }
  }

  const apiKey = getComposioApiKey();

  // Composio v3 API uses DELETE method
  const url = `https://backend.composio.dev/api/v3/connected_accounts/${connectedAccountId}`;

  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to disconnect (${response.status}): ${errorText}`);
  }

  return { success: true };
}
