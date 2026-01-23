import { getComposioClient } from "../client";
import { getCallbackUrl } from "../getCallbackUrl";

/**
 * Toolkits available in Tool Router sessions.
 * Add more toolkits here as we expand Composio integration.
 */
const ENABLED_TOOLKITS = ["googlesheets", "googledrive", "googledocs"];

/**
 * Create a Composio Tool Router session for a user.
 */
export async function createToolRouterSession(userId: string, roomId?: string) {
  const composio = await getComposioClient();

  const callbackUrl = getCallbackUrl({
    destination: "chat",
    roomId,
  });

  const session = await composio.create(userId, {
    toolkits: ENABLED_TOOLKITS,
    manageConnections: {
      callbackUrl,
    },
  });

  return session;
}
