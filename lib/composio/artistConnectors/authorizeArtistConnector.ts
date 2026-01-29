import { getComposioClient } from "../client";
import { getFrontendBaseUrl } from "../getFrontendBaseUrl";

/**
 * Result of authorizing an artist connector.
 */
export interface AuthorizeArtistConnectorResult {
  connector: string;
  redirectUrl: string;
}

/**
 * Build callback URL for artist connector OAuth.
 *
 * Redirects to /chat with artist_connected and toolkit query params
 * so the frontend can complete the connection flow.
 */
function buildArtistConnectorCallbackUrl(
  artistId: string,
  toolkit: string,
): string {
  const baseUrl = getFrontendBaseUrl();
  return `${baseUrl}/chat?artist_connected=${artistId}&toolkit=${toolkit}`;
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

  const callbackUrl = buildArtistConnectorCallbackUrl(artistId, connector);

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
