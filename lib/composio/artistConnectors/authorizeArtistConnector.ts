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
 * Why: Used by the /api/artist-connectors/authorize endpoint to let users
 * connect external services (like TikTok) for a specific artist.
 *
 * @param accountId - The user's account ID (used as Composio entity)
 * @param artistId - The artist ID to associate the connection with
 * @param connector - The connector slug (e.g., "tiktok")
 * @returns The redirect URL for OAuth
 */
export async function authorizeArtistConnector(
  accountId: string,
  artistId: string,
  connector: string,
): Promise<AuthorizeArtistConnectorResult> {
  const composio = await getComposioClient();

  const callbackUrl = getCallbackUrl({
    destination: "artist-connectors",
    artistId,
    toolkit: connector,
  });

  const session = await composio.create(accountId, {
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
