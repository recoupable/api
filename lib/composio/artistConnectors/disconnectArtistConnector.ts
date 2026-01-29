import { getComposioApiKey } from "../getComposioApiKey";
import { getComposioClient } from "../client";

/**
 * Disconnect an artist connector from Composio.
 *
 * Uses artistId as the Composio entity to verify the connection exists
 * and belongs to this artist before deleting.
 *
 * @param artistId - The artist ID (Composio entity)
 * @param connectedAccountId - The ID of the connected account to disconnect
 * @returns Success status
 */
export async function disconnectArtistConnector(
  artistId: string,
  connectedAccountId: string
): Promise<{ success: boolean }> {
  const composio = await getComposioClient();

  // Create session with artistId to verify the connection belongs to this artist
  const session = await composio.create(artistId);
  const toolkits = await session.toolkits();

  // Find the connection to verify ownership
  const hasConnection = toolkits.items.some(
    (toolkit) => toolkit.connection?.connectedAccount?.id === connectedAccountId
  );

  if (!hasConnection) {
    throw new Error("Connection not found for this artist");
  }

  // Delete from Composio using their v3 API
  const apiKey = getComposioApiKey();
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
      `Failed to disconnect from Composio (${response.status}): ${errorText}`
    );
  }

  return { success: true };
}
