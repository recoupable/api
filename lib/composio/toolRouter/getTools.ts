import type { ToolSet } from "ai";
import { getComposioClient } from "../client";
import { getCallbackUrl } from "../getCallbackUrl";
import { getConnectors } from "../connectors/getConnectors";
import { checkAccountArtistAccess } from "@/lib/artists/checkAccountArtistAccess";
import { getSharedAccountConnections } from "./getSharedAccountConnections";
import { resolveSessionToolkits } from "./resolveSessionToolkits";
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
 * Artist and shared tools go through composio.tools.get() rather than a
 * Tool Router session because Composio rejects cross-account
 * connectedAccounts overrides at execute time — each explicit tool must
 * be owned by the account whose id we pass in.
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

    const resolved = resolveSessionToolkits({
      enabledToolkits: ENABLED_TOOLKITS,
      customerConnectedSlugs: toConnectedSlugs(customerConnectors),
      artistConnectedSlugs: toConnectedSlugs(artistConnectors),
      sharedConnectedSlugs: new Set(Object.keys(sharedConnections)),
    });

    const customerAuthConfigs = scopedAuthConfigs(resolved.customer);

    const customerSession = await composio.create(accountId, {
      toolkits: resolved.customer,
      manageConnections: { callbackUrl },
      ...(customerAuthConfigs && { authConfigs: customerAuthConfigs }),
    });

    const [customerRaw, artistTools, sharedTools] = await Promise.all([
      customerSession.tools() as Promise<Record<string, unknown>>,
      fetchOwnerTools({
        composio,
        ownerId: effectiveArtistId,
        toolkits: resolved.artist,
        label: "artist",
        limit: TOOLS_LIMIT,
      }),
      fetchOwnerTools({
        composio,
        ownerId: SHARED_ACCOUNT_ID,
        toolkits: resolved.shared,
        label: "shared",
        limit: TOOLS_LIMIT,
      }),
    ]);

    return {
      ...pickValid(customerRaw, name => META_TOOLS.has(name)),
      ...pickValid(artistTools, name => !META_TOOLS.has(name)),
      ...pickValid(sharedTools, name => !META_TOOLS.has(name)),
    };
  } catch (error) {
    console.warn("Composio tools unavailable:", (error as Error).message);
    return {};
  }
}
