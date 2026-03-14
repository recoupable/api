import { getFrontendBaseUrl } from "./getFrontendBaseUrl";

/**
 * Build OAuth callback URL based on environment and destination.
 *
 * Why: Composio redirects users back after OAuth. We need different
 * destinations depending on context (chat room vs settings page).
 */

type CallbackDestination = "chat" | "connectors";

interface CallbackOptions {
  destination: CallbackDestination;
  roomId?: string;
}

/**
 * Build callback URL for OAuth redirects.
 *
 * @param options.destination - Where to redirect: "chat" or "connectors"
 * @param options.roomId - For chat destination, the room ID to return to
 * @param options
 * @returns Full callback URL with success indicator
 */
export function getCallbackUrl(options: CallbackOptions): string {
  const baseUrl = getFrontendBaseUrl();

  if (options.destination === "connectors") {
    return `${baseUrl}/settings/connectors?connected=true`;
  }

  // Chat destination
  const path = options.roomId ? `/chat/${options.roomId}` : "/chat";
  return `${baseUrl}${path}?connected=true`;
}
