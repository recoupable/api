import type { ToolSet } from "ai";
import { getComposioClient } from "../client";
import { getCallbackUrl } from "../getCallbackUrl";
import { getConnectors } from "../connectors/getConnectors";
import { checkAccountArtistAccess } from "@/lib/artists/checkAccountArtistAccess";
import { getSharedAccountConnections } from "./getSharedAccountConnections";
import { pickValid } from "./pickValid";
import { scopedAuthConfigs } from "./scopedAuthConfigs";
import { toConnectedSlugs } from "./toConnectedSlugs";
import { fetchOwnerTools } from "./fetchOwnerTools";

export const ENABLED_TOOLKITS = [
  "googlesheets",
  "googledrive",
  "googledocs",
  "tiktok",
  "instagram",
  "youtube",
];

const SHARED_ACCOUNT_ID = "recoup-shared-767f498e-e1e9-43c6-a152-a96ae3bd8d07";

const META_TOOLS = new Set([
  "COMPOSIO_MANAGE_CONNECTIONS",
  "COMPOSIO_SEARCH_TOOLS",
  "COMPOSIO_GET_TOOL_SCHEMAS",
  "COMPOSIO_MULTI_EXECUTE_TOOL",
]);

const TOOLS_LIMIT = 1000;

/**
 * Resolve the LLM tool catalog for a chat request.
 *
 * Every chat is artist-scoped, so the Tool Router session is created
 * against the artist (not the authenticated customer). This ensures
 * `COMPOSIO_MANAGE_CONNECTIONS` initiates OAuth under the artist's
 * accountId — connections made via the in-chat connect prompt land
 * where they belong instead of polluting the customer's account.
 *
 * Real artist tools still go through `composio.tools.get(artistId, ...)`
 * because Composio rejects cross-account `connectedAccounts` overrides
 * at execute time — each explicit tool must be owned by the account
 * whose id we pass in. Shared platform tools come from the
 * `recoup-shared` account the same way.
 *
 * If `artistId` is missing or the customer doesn't have access, no
 * Composio tools are returned — chats without an artist context don't
 * use this code path.
 *
 * @param accountId - Authenticated customer (used only for artist-access check)
 * @param artistId - Artist account this chat is scoped to (required)
 * @param roomId - Optional chat room id used to build the post-OAuth callback URL
 */
export async function getComposioTools(
  accountId: string,
  artistId?: string,
  roomId?: string,
): Promise<ToolSet> {
  if (!process.env.COMPOSIO_API_KEY) return {};

  try {
    if (!artistId) return {};
    const hasAccess = await checkAccountArtistAccess(accountId, artistId);
    if (!hasAccess) return {};

    const composio = await getComposioClient();
    const callbackUrl = getCallbackUrl({ destination: "chat", roomId });

    const [artistConnectors, sharedConnections] = await Promise.all([
      getConnectors(artistId),
      getSharedAccountConnections(),
    ]);

    const artistConnectedSlugs = toConnectedSlugs(artistConnectors);
    const sharedConnectedSlugs = new Set(Object.keys(sharedConnections));

    const artistRealToolkits = ENABLED_TOOLKITS.filter(slug => artistConnectedSlugs.has(slug));
    const sharedRealToolkits = ENABLED_TOOLKITS.filter(
      slug => sharedConnectedSlugs.has(slug) && !artistConnectedSlugs.has(slug),
    );

    const authConfigs = scopedAuthConfigs(ENABLED_TOOLKITS);
    const artistSession = await composio.create(artistId, {
      toolkits: ENABLED_TOOLKITS,
      manageConnections: { callbackUrl },
      ...(authConfigs && { authConfigs }),
    });

    const [artistSessionRaw, artistTools, sharedTools] = await Promise.all([
      artistSession.tools() as Promise<Record<string, unknown>>,
      fetchOwnerTools({
        composio,
        ownerId: artistId,
        toolkits: artistRealToolkits,
        label: "artist",
        limit: TOOLS_LIMIT,
      }),
      fetchOwnerTools({
        composio,
        ownerId: SHARED_ACCOUNT_ID,
        toolkits: sharedRealToolkits,
        label: "shared",
        limit: TOOLS_LIMIT,
      }),
    ]);

    return {
      ...pickValid(artistSessionRaw, name => META_TOOLS.has(name)),
      ...pickValid(artistTools, name => !META_TOOLS.has(name)),
      ...pickValid(sharedTools, name => !META_TOOLS.has(name)),
    };
  } catch (error) {
    console.warn("Composio tools unavailable:", (error as Error).message);
    return {};
  }
}
