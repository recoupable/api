import { getComposioClient } from "../client";
import { ALLOWED_ARTIST_CONNECTORS } from "./ALLOWED_ARTIST_CONNECTORS";

/**
 * Artist connector info with connection status.
 */
export interface ArtistConnectorInfo {
  slug: string;
  name: string;
  isConnected: boolean;
  connectedAccountId?: string;
}

/**
 * Human-readable names for allowed artist connectors.
 */
const CONNECTOR_NAMES: Record<string, string> = {
  tiktok: "TikTok",
};

/**
 * Get all allowed artist connectors with their connection status.
 *
 * Queries Composio directly using artistId as the entity to check
 * which connectors are connected. Composio is the source of truth.
 *
 * @param artistId - The artist ID (used as Composio entity)
 * @returns Array of connector info with connection status
 */
export async function getArtistConnectors(
  artistId: string
): Promise<ArtistConnectorInfo[]> {
  const composio = await getComposioClient();

  // Create session with artistId as entity to check their connections
  const session = await composio.create(artistId, {
    toolkits: ALLOWED_ARTIST_CONNECTORS,
  });

  // Get all toolkits and their connection status
  const toolkits = await session.toolkits();

  // Create a map of slug -> connectedAccountId for quick lookup
  const connectionMap = new Map<string, string>();
  for (const toolkit of toolkits.items) {
    const connectedAccountId = toolkit.connection?.connectedAccount?.id;
    if (connectedAccountId) {
      connectionMap.set(toolkit.slug, connectedAccountId);
    }
  }

  // Build connector list with status for allowed connectors
  return ALLOWED_ARTIST_CONNECTORS.map((slug) => {
    const connectedAccountId = connectionMap.get(slug);
    return {
      slug,
      name: CONNECTOR_NAMES[slug] || slug,
      isConnected: !!connectedAccountId,
      connectedAccountId,
    };
  });
}
