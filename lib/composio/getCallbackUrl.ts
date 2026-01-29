import { getFrontendBaseUrl } from "./getFrontendBaseUrl";

/**
 * Build OAuth callback URL based on environment and destination.
 *
 * Why: Composio redirects users back after OAuth. We need different
 * destinations depending on context (chat room vs settings page vs artist connections).
 */

type CallbackDestination = "chat" | "connectors" | "artist-connectors";

interface CallbackOptions {
  destination: CallbackDestination;
  roomId?: string;
  artistId?: string;
  toolkit?: string;
}

/**
 * Build callback URL for OAuth redirects.
 *
 * @param options.destination - Where to redirect: "chat", "connectors", or "artist-connectors"
 * @param options.roomId - For chat destination, the room ID to return to
 * @param options.artistId - For artist-connectors destination, the artist ID
 * @param options.toolkit - For artist-connectors destination, the toolkit slug
 * @returns Full callback URL with success indicator
 */
export function getCallbackUrl(options: CallbackOptions): string {
  const baseUrl = getFrontendBaseUrl();

  if (options.destination === "connectors") {
    return `${baseUrl}/settings/connectors?connected=true`;
  }

  if (options.destination === "artist-connectors") {
    return `${baseUrl}/chat?artist_connected=${options.artistId}&toolkit=${options.toolkit}`;
  }

  // Chat destination
  const path = options.roomId ? `/chat/${options.roomId}` : "/chat";
  return `${baseUrl}${path}?connected=true`;
}
