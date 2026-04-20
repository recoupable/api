import { getComposioClient } from "../client";
import { getCallbackUrl } from "../getCallbackUrl";
import { getConnectors } from "../connectors/getConnectors";
import { buildAuthConfigs } from "../connectors/buildAuthConfigs";
import { getSharedAccountConnections } from "./getSharedAccountConnections";

/**
 * Toolkits available in Tool Router sessions.
 * Add more toolkits here as we expand Composio integration.
 */
const ENABLED_TOOLKITS = ["googlesheets", "googledrive", "googledocs", "tiktok"];

/**
 * Create a Composio Tool Router session for an account.
 *
 * This is the opinionated layer — it decides which connections the AI agent uses.
 *
 * Connection priority (highest wins):
 * 1. Account's own connections
 * 2. Artist-specific connections (for non-overlapping toolkits)
 * 3. shared@recoupable.com connections (Google toolkits only, for non-overlapping toolkits)
 *
 * The shared account fallback allows customers to share specific Google Drive files
 * with shared@recoupable.com instead of granting full account access.
 *
 * @param accountId - Unique identifier for the account
 * @param roomId - Optional chat room ID for OAuth redirect
 * @param artistConnections - Optional mapping of toolkit slug to connected account ID for artist-specific connections
 */
export async function createToolRouterSession(
  accountId: string,
  roomId?: string,
  artistConnections?: Record<string, string>,
) {
  const composio = await getComposioClient();

  const callbackUrl = getCallbackUrl({
    destination: "chat",
    roomId,
  });

  // Fetch shared account Google connections (may be empty if not configured).
  const sharedConnections = await getSharedAccountConnections();
  const hasArtistConnections = artistConnections && Object.keys(artistConnections).length > 0;
  const hasSharedConnections = Object.keys(sharedConnections).length > 0;

  // Fetch account connectors when we need to check for overlap
  let accountConnectedSlugs = new Set<string>();
  if (hasArtistConnections || hasSharedConnections) {
    const accountConnectors = await getConnectors(accountId);
    accountConnectedSlugs = new Set(accountConnectors.filter(c => c.isConnected).map(c => c.slug));
  }

  // Filter artist connections to prevent tool collision.
  // Account connections always win over artist connections.
  let mergedConnections: Record<string, string> | undefined;

  if (hasArtistConnections) {
    mergedConnections = Object.fromEntries(
      Object.entries(artistConnections!).filter(([slug]) => !accountConnectedSlugs.has(slug)),
    );
  }

  // Add shared connections as fallback for Google toolkits.
  // Only fill toolkits not already covered by account or artist connections.
  if (hasSharedConnections) {
    const existingSlugs = new Set([
      ...accountConnectedSlugs,
      ...Object.keys(mergedConnections || {}),
    ]);

    for (const [slug, connectedAccountId] of Object.entries(sharedConnections)) {
      if (!existingSlugs.has(slug)) {
        if (!mergedConnections) {
          mergedConnections = {};
        }
        mergedConnections[slug] = connectedAccountId;
      }
    }
  }

  // If nothing in mergedConnections, pass undefined
  if (mergedConnections && Object.keys(mergedConnections).length === 0) {
    mergedConnections = undefined;
  }

  // Only pass auth configs for toolkits enabled in this session —
  // Composio rejects overrides that reference unlisted toolkits.
  const allAuthConfigs = buildAuthConfigs();
  const enabledSet = new Set(ENABLED_TOOLKITS);
  const authConfigs = allAuthConfigs
    ? Object.fromEntries(Object.entries(allAuthConfigs).filter(([slug]) => enabledSet.has(slug)))
    : undefined;
  const hasAuthConfigs = authConfigs && Object.keys(authConfigs).length > 0;

  const session = await composio.create(accountId, {
    toolkits: ENABLED_TOOLKITS,
    manageConnections: {
      callbackUrl,
    },
    connectedAccounts: mergedConnections,
    ...(hasAuthConfigs && { authConfigs }),
  });

  return session;
}
