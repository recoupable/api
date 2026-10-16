import { getConnectors } from "@/lib/composio/connectors/getConnectors";
import { PLATFORM_TOOLKITS, type PostPlatform } from "@/lib/publishing/const";

/**
 * The account's own active connection for a platform.
 *
 * Only the account's connections count. The chat tool router also falls back
 * to Recoup's shared connections, which for posting would publish to the wrong
 * account, so a post never runs without one of the account's own.
 *
 * @param accountId - The account whose connection posts.
 * @param platform - Target platform.
 * @returns The Composio connected account id, or null when not connected.
 */
export async function findConnectedAccountId(
  accountId: string,
  platform: PostPlatform,
): Promise<string | null> {
  const connectors = await getConnectors(accountId);
  const connector = connectors.find(c => c.slug === PLATFORM_TOOLKITS[platform] && c.isConnected);
  return connector?.connectedAccountId ?? null;
}
