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

/**
 * Toolkits enabled in Tool Router sessions for the customer. Extend as we
 * onboard more Composio toolkits.
 */
export const ENABLED_TOOLKITS = [
  "googlesheets",
  "googledrive",
  "googledocs",
  "tiktok",
  "instagram",
];

/**
 * Composio account ID for the shared Recoupable Google account. Used as the
 * owner for Google Drive/Sheets/Docs tools when neither the customer nor the
 * artist has their own Google connection.
 */
const SHARED_ACCOUNT_ID = "recoup-shared-767f498e-e1e9-43c6-a152-a96ae3bd8d07";

/**
 * Meta-tools exposed by every Composio Tool Router session. Only the
 * customer's session surfaces these to the agent — artist and shared tools
 * are surfaced as explicit toolkit tools instead, so the agent can call
 * them directly and hit a session whose owner actually owns the
 * underlying connection.
 */
const META_TOOLS = new Set([
  "COMPOSIO_MANAGE_CONNECTIONS",
  "COMPOSIO_SEARCH_TOOLS",
  "COMPOSIO_GET_TOOL_SCHEMAS",
  "COMPOSIO_MULTI_EXECUTE_TOOL",
]);

/** Composio tool page size when fetching explicit toolkit tools. */
const TOOLS_LIMIT = 1000;

/**
 * Get Composio Tool Router tools for a chat request.
 *
 * Returns a merged ToolSet drawn from up to three owners:
 * - Customer (always): the 4 Composio meta-tools (SEARCH_TOOLS /
 *   GET_TOOL_SCHEMAS / MULTI_EXECUTE_TOOL / MANAGE_CONNECTIONS) via a Tool
 *   Router session. The agent uses these to dynamically discover and
 *   execute tools against the caller's own connections.
 * - Artist (when artistId has access and covers toolkits the customer
 *   does not): explicit Composio tools (TIKTOK_*, INSTAGRAM_*) fetched
 *   via `composio.tools.get(artistId, …)` so each tool executes against
 *   the artist's connection.
 * - Shared (when the shared Recoupable Google account covers Google
 *   toolkits no one else has): explicit Composio tools
 *   (GOOGLEDOCS_*, GOOGLEDRIVE_*, GOOGLESHEETS_*) fetched the same way.
 *
 * Priority is customer > artist > shared, enforced by toolkit filtering
 * before any tools are fetched so no toolkit appears under two owners.
 *
 * Gracefully returns `{}` if Composio is unreachable or packages fail to
 * load (e.g. bundler incompatibility with createRequire).
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
      effectiveArtistId && resolved.artist.length > 0
        ? (composio.tools.get(effectiveArtistId, {
            toolkits: resolved.artist,
            limit: TOOLS_LIMIT,
          }) as Promise<Record<string, unknown>>)
        : Promise.resolve({} as Record<string, unknown>),
      resolved.shared.length > 0
        ? (composio.tools.get(SHARED_ACCOUNT_ID, {
            toolkits: resolved.shared,
            limit: TOOLS_LIMIT,
          }) as Promise<Record<string, unknown>>)
        : Promise.resolve({} as Record<string, unknown>),
    ]);

    const customerTools = pickValid(customerRaw, name => META_TOOLS.has(name));
    const artistExplicit = pickValid(artistTools, name => !META_TOOLS.has(name));
    const sharedExplicit = pickValid(sharedTools, name => !META_TOOLS.has(name));

    return { ...customerTools, ...artistExplicit, ...sharedExplicit };
  } catch (error) {
    console.warn("Composio tools unavailable:", (error as Error).message);
    return {};
  }
}
