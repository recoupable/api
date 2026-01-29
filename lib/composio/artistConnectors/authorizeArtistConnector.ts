import { getComposioClient } from "../client";
import { getCallbackUrl } from "../getCallbackUrl";

/**
 * Result of authorizing an artist connector.
 */
export interface AuthorizeArtistConnectorResult {
  connector: string;
  redirectUrl: string;
}

/**
 * Generate an OAuth authorization URL for an artist connector.
 *
 * Uses artistId as the Composio entity so that connections are stored
 * under the artist, not the user. This keeps Composio as the source of truth.
 *
 * @param artistId - The artist ID (used as Composio entity)
 * @param connector - The connector slug (e.g., "tiktok")
 * @returns The redirect URL for OAuth
 */
export async function authorizeArtistConnector(
  artistId: string,
  connector: string,
): Promise<AuthorizeArtistConnectorResult> {
  const composio = await getComposioClient();

  const callbackUrl = getCallbackUrl({
    destination: "artist-connectors",
    artistId,
    toolkit: connector,
  });

  // Use artistId as the Composio entity - connection will be stored under the artist
  const session = await composio.create(artistId, {
    manageConnections: {
      callbackUrl,
    },
  });

  const connectionRequest = await session.authorize(connector);

  return {
    connector,
    redirectUrl: connectionRequest.redirectUrl,
  };
}
