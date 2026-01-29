import { selectArtistComposioConnections } from "@/lib/supabase/artist_composio_connections/selectArtistComposioConnections";

/**
 * Verifies that a connected account ID belongs to the specified artist.
 *
 * Why: Before disconnecting an artist connector, we must verify that the
 * connected account actually belongs to this artist to prevent users from
 * disconnecting connections from other artists they may not own.
 *
 * @param artistId - The artist ID
 * @param connectedAccountId - The connected account ID to verify
 * @returns true if the connected account belongs to the artist, false otherwise
 */
export async function verifyArtistConnectorOwnership(
  artistId: string,
  connectedAccountId: string,
): Promise<boolean> {
  const connections = await selectArtistComposioConnections(artistId);

  // Check if any of the artist's connections match this connected account ID
  return connections.some(connection => connection.connected_account_id === connectedAccountId);
}
