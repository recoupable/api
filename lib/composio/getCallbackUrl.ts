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
 * @param root0 - The callback options
 * @param root0.destination - Where to redirect: "chat" or "connectors"
 * @param root0.roomId - For chat destination, the room ID to return to
 * @returns Full callback URL with success indicator
 */
export function getCallbackUrl({ destination, roomId }: CallbackOptions): string {
  const baseUrl = getFrontendBaseUrl();

  if (destination === "connectors") {
    return `${baseUrl}/settings/connectors?connected=true`;
  }

  // Chat destination
  const path = roomId ? `/chat/${roomId}` : "/chat";
  return `${baseUrl}${path}?connected=true`;
}
