import { getComposioClient } from "@/lib/composio/client";

export type PostActionTarget = {
  accountId: string;
  connectedAccountId: string;
};

/**
 * Execute one Composio action on a specific connection.
 *
 * Pins `connectedAccountId` so the call can only use the account's own
 * connection (see findConnectedAccountId), and throws on an unsuccessful
 * result so a failed upload or post never reads as success.
 *
 * @param target - The posting account and its connection.
 * @param slug - Composio action slug, e.g. `INSTAGRAM_POST_IG_USER_MEDIA`.
 * @param args - Action arguments.
 * @returns The action's `data`.
 */
export async function executePostAction(
  target: PostActionTarget,
  slug: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const composio = await getComposioClient();
  const response = await composio.tools.execute(slug, {
    userId: target.accountId,
    connectedAccountId: target.connectedAccountId,
    arguments: args,
    // Same toolkit versions the chat tool router executes with.
    dangerouslySkipVersionCheck: true,
  });

  if (!response.successful) {
    throw new Error(`${slug} failed: ${response.error ?? "unknown error"}`);
  }

  return response.data;
}
