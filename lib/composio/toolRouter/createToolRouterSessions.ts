import { getComposioClient } from "../client";
import { getCallbackUrl } from "../getCallbackUrl";
import { getConnectors } from "../connectors/getConnectors";
import { buildAuthConfigs } from "../connectors/buildAuthConfigs";
import { getSharedAccountConnections } from "./getSharedAccountConnections";
import { resolveSessionToolkits } from "./resolveSessionToolkits";

type ComposioSession = Awaited<ReturnType<Awaited<ReturnType<typeof getComposioClient>>["create"]>>;

/**
 * Toolkits enabled in Tool Router sessions. Add more here as we expand
 * Composio integration.
 */
export const ENABLED_TOOLKITS = [
  "googlesheets",
  "googledrive",
  "googledocs",
  "tiktok",
  "instagram",
];

/**
 * Composio account ID for the shared Recoupable Google account, used as a
 * fallback owner for Google Drive/Sheets/Docs when neither the customer nor
 * the artist has their own Google connection.
 */
const SHARED_ACCOUNT_ID = "recoup-shared-767f498e-e1e9-43c6-a152-a96ae3bd8d07";

export interface CreateToolRouterSessionsInput {
  customerAccountId: string;
  /** Optional artist context. Caller is responsible for access-checking this first. */
  artistId?: string;
  /** Optional chat room id — used to build the OAuth callback URL. */
  roomId?: string;
}

export interface ToolRouterSessions {
  customer: ComposioSession;
  artist?: ComposioSession;
  shared?: ComposioSession;
}

function toConnectedSlugs(connectors: Awaited<ReturnType<typeof getConnectors>>): Set<string> {
  return new Set(connectors.filter(c => c.isConnected).map(c => c.slug));
}

/**
 * Build the Composio session(s) required for this chat request.
 *
 * Each session is owned by the account that genuinely owns the connections
 * it exposes — Composio Tool Router V2 checks ownership at tool-execute time
 * and rejects cross-account connectedAccounts overrides, so we never pass
 * one. Priority among sessions is customer > artist > shared, enforced by
 * filtering toolkits per session before any session is created.
 */
export async function createToolRouterSessions(
  input: CreateToolRouterSessionsInput,
): Promise<ToolRouterSessions> {
  const { customerAccountId, artistId, roomId } = input;

  const composio = await getComposioClient();
  const callbackUrl = getCallbackUrl({ destination: "chat", roomId });

  const [customerConnectors, artistConnectors, sharedConnectionsMap] = await Promise.all([
    getConnectors(customerAccountId),
    artistId ? getConnectors(artistId) : Promise.resolve([]),
    getSharedAccountConnections(),
  ]);

  const resolved = resolveSessionToolkits({
    enabledToolkits: ENABLED_TOOLKITS,
    customerConnectedSlugs: toConnectedSlugs(customerConnectors),
    artistConnectedSlugs: toConnectedSlugs(artistConnectors),
    sharedConnectedSlugs: new Set(Object.keys(sharedConnectionsMap)),
  });

  const allAuthConfigs = buildAuthConfigs();
  const buildSessionOpts = (toolkits: string[]) => {
    const enabledSet = new Set(toolkits);
    const filtered = allAuthConfigs
      ? Object.fromEntries(Object.entries(allAuthConfigs).filter(([slug]) => enabledSet.has(slug)))
      : undefined;
    const hasAuthConfigs = filtered && Object.keys(filtered).length > 0;
    return {
      toolkits,
      manageConnections: { callbackUrl },
      ...(hasAuthConfigs && { authConfigs: filtered }),
    };
  };

  const customer = await composio.create(customerAccountId, buildSessionOpts(resolved.customer));

  const artist =
    artistId && resolved.artist.length > 0
      ? await composio.create(artistId, buildSessionOpts(resolved.artist))
      : undefined;

  const shared =
    resolved.shared.length > 0
      ? await composio.create(SHARED_ACCOUNT_ID, buildSessionOpts(resolved.shared))
      : undefined;

  return { customer, artist, shared };
}
