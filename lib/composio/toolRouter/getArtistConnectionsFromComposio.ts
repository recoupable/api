import { getConnectors, ALLOWED_ARTIST_CONNECTORS } from "../connectors";

/**
 * Query Composio for an artist's connected accounts.
 *
 * Uses artistId as the Composio entity to get their connections.
 * Only returns connections for ALLOWED_ARTIST_CONNECTORS (e.g., tiktok).
 *
 * @param artistId - The artist ID (Composio entity)
 * @returns Map of toolkit slug to connected account ID
 */
export async function getArtistConnectionsFromComposio(
  artistId: string,
): Promise<Record<string, string>> {
  const connectors = await getConnectors(artistId);

  // Build connections map, filtered to allowed artist connectors
  const allowed = new Set<string>(ALLOWED_ARTIST_CONNECTORS);
  const connections: Record<string, string> = {};
  for (const connector of connectors) {
    if (allowed.has(connector.slug) && connector.connectedAccountId) {
      connections[connector.slug] = connector.connectedAccountId;
    }
  }

  return connections;
}
