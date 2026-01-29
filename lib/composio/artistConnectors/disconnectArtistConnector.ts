import { getComposioApiKey } from "../getComposioApiKey";
import { deleteArtistComposioConnection } from "@/lib/supabase/artist_composio_connections/deleteArtistComposioConnection";
import { selectArtistComposioConnections } from "@/lib/supabase/artist_composio_connections/selectArtistComposioConnections";

/**
 * Disconnect an artist connector from Composio and remove the DB record.
 *
 * Why: When an artist disconnects a service (like TikTok), we need to:
 * 1. Delete the connected account from Composio's side
 * 2. Remove the mapping from our artist_composio_connections table
 *
 * @param artistId - The artist ID
 * @param connectedAccountId - The ID of the connected account to disconnect
 * @returns Success status
 */
export async function disconnectArtistConnector(
  artistId: string,
  connectedAccountId: string,
): Promise<{ success: boolean }> {
  // First, find the connection record in our DB to get the ID
  const connections = await selectArtistComposioConnections(artistId);
  const connection = connections.find(c => c.connected_account_id === connectedAccountId);

  if (!connection) {
    throw new Error("Connection not found");
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
    throw new Error(`Failed to disconnect from Composio (${response.status}): ${errorText}`);
  }

  // Remove from our DB
  const { error } = await deleteArtistComposioConnection(connection.id);

  if (error) {
    throw new Error(`Failed to remove connection record: ${error.message}`);
  }

  return { success: true };
}
