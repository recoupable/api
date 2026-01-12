import { getComposioApiKey } from "../getComposioApiKey";

/**
 * Disconnect a connected account from Composio.
 *
 * Why: Composio's Tool Router SDK doesn't expose a disconnect method,
 * so we call the REST API directly to delete the connection.
 *
 * @param connectedAccountId - The ID of the connected account to disconnect
 * @returns Success status
 */
export async function disconnectConnector(
  connectedAccountId: string,
): Promise<{ success: boolean }> {
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
    throw new Error(
      `Failed to disconnect (${response.status}): ${errorText}`,
    );
  }

  return { success: true };
}
