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
 * Real tools come from `composio.tools.get(ownerId, …)` per owner;
 * meta-tools come from a customer Tool Router session. The merge
 * spreads in priority order so collisions resolve to the right owner:
 * shared (lowest) → customer → artist (highest, when in scope).
 */
export async function getComposioTools(
  accountId: string,
  artistId?: string,
  roomId?: string,
): Promise<ToolSet> {
  if (!process.env.COMPOSIO_API_KEY) return {};

  try {
    const effectiveArtistId =
      artistId && (await checkAccountArtistAccess(accountId, artistId)) ? artistId : undefined;

    const composio = await getComposioClient();
    const callbackUrl = getCallbackUrl({ destination: "chat", roomId });

    const [customerConnectors, artistConnectors, sharedConnections] = await Promise.all([
      getConnectors(accountId),
      effectiveArtistId ? getConnectors(effectiveArtistId) : Promise.resolve([]),
      getSharedAccountConnections(),
    ]);

    const customerConnectedSlugs = toConnectedSlugs(customerConnectors);
    const artistConnectedSlugs = toConnectedSlugs(artistConnectors);
    const sharedConnectedSlugs = new Set(Object.keys(sharedConnections));

    const customerToolkits = ENABLED_TOOLKITS.filter(s => customerConnectedSlugs.has(s));
    const artistToolkits = ENABLED_TOOLKITS.filter(s => artistConnectedSlugs.has(s));
    const sharedToolkits = ENABLED_TOOLKITS.filter(s => sharedConnectedSlugs.has(s));

    const customerAuthConfigs = scopedAuthConfigs(ENABLED_TOOLKITS);
    const customerSession = await composio.create(accountId, {
      toolkits: ENABLED_TOOLKITS,
      manageConnections: { callbackUrl },
      ...(customerAuthConfigs && { authConfigs: customerAuthConfigs }),
    });

    const [customerRaw, customerTools, artistTools, sharedTools] = await Promise.all([
      customerSession.tools() as Promise<Record<string, unknown>>,
      fetchOwnerTools({
        composio,
        ownerId: customerToolkits.length > 0 ? accountId : undefined,
        toolkits: customerToolkits,
        label: "customer",
        limit: TOOLS_LIMIT,
      }),
      fetchOwnerTools({
        composio,
        ownerId: effectiveArtistId,
        toolkits: artistToolkits,
        label: "artist",
        limit: TOOLS_LIMIT,
      }),
      fetchOwnerTools({
        composio,
        ownerId: SHARED_ACCOUNT_ID,
        toolkits: sharedToolkits,
        label: "shared",
        limit: TOOLS_LIMIT,
      }),
    ]);

    return {
      ...pickValid(customerRaw, name => META_TOOLS.has(name)),
      ...pickValid(sharedTools, name => !META_TOOLS.has(name)),
      ...pickValid(customerTools, name => !META_TOOLS.has(name)),
      ...pickValid(artistTools, name => !META_TOOLS.has(name)),
    };
  } catch (error) {
    console.warn("Composio tools unavailable:", (error as Error).message);
    return {};
  }
}
