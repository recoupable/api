import { getComposioClient } from "../client";
import { getCallbackUrl } from "../getCallbackUrl";

/**
 * Create a Composio Tool Router session for a user.
 *
 * Why: Tool Router provides meta-tools for searching, connecting,
 * and executing 500+ connectors through a single session.
 *
 * @param userId - Unique identifier for the user (accountId)
 * @param roomId - Optional chat room ID for OAuth redirect
 * @returns Composio Tool Router session
 */
export async function createToolRouterSession(userId: string, roomId?: string) {
  const composio = getComposioClient();

  const callbackUrl = getCallbackUrl({
    destination: "chat",
    roomId,
  });

  const session = await composio.create(userId, {
    manageConnections: {
      callbackUrl,
    },
  });

  return session;
}
