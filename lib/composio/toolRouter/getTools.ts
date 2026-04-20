import { createToolRouterSessions, type ToolRouterSessions } from "./createToolRouterSessions";
import { checkAccountArtistAccess } from "@/lib/artists/checkAccountArtistAccess";
import type { Tool, ToolSet } from "ai";

/**
 * Composio meta-tools. Only the customer session exposes these — the agent
 * uses them to dynamically discover and execute tools against its own
 * connections. Artist and shared sessions only expose their explicit
 * toolkit tools by name (TIKTOK_*, GOOGLEDOCS_*, etc.) so the agent can
 * call them directly and hit a session whose owner actually owns the
 * underlying connection.
 */
const META_TOOLS = new Set([
  "COMPOSIO_MANAGE_CONNECTIONS",
  "COMPOSIO_SEARCH_TOOLS",
  "COMPOSIO_GET_TOOL_SCHEMAS",
  "COMPOSIO_MULTI_EXECUTE_TOOL",
]);

/**
 * Runtime check that an object is a valid Vercel AI SDK Tool.
 * Composio's SDK returns tools with `inputSchema` + `execute`; the AI SDK
 * accepts `inputSchema` as an alias for `parameters`.
 */
function isValidTool(tool: unknown): tool is Tool {
  if (typeof tool !== "object" || tool === null) return false;
  const obj = tool as Record<string, unknown>;
  const hasExecute = typeof obj.execute === "function";
  const hasSchema = "parameters" in obj || "inputSchema" in obj;
  return hasExecute && hasSchema;
}

async function collectTools(
  session: ToolRouterSessions["customer"] | undefined,
  filter: (toolName: string) => boolean,
  label: string,
): Promise<ToolSet> {
  if (!session) return {};
  const all = (await session.tools()) as Record<string, unknown>;
  console.info("[getComposioTools] session.tools()", {
    label,
    totalTools: Object.keys(all).length,
    toolNames: Object.keys(all),
  });
  const out: ToolSet = {};
  for (const [name, tool] of Object.entries(all)) {
    if (!filter(name)) continue;
    if (isValidTool(tool)) out[name] = tool;
  }
  return out;
}

/**
 * Get Composio Tool Router tools for a chat request.
 *
 * Returns a merged ToolSet drawn from up to three sessions:
 * - Customer session (always): the 4 Composio meta-tools.
 * - Artist session (when artistId has access and non-overlapping toolkits):
 *   explicit Composio tools for that artist's connections (e.g. TIKTOK_*).
 * - Shared session (when the shared Recoupable Google account covers
 *   Google toolkits no one else has): explicit Composio tools
 *   (e.g. GOOGLEDOCS_*).
 *
 * Gracefully returns `{}` if Composio is unreachable or packages fail to
 * load (e.g. bundler incompatibility).
 *
 * @param accountId - The caller's account ID.
 * @param artistId  - Optional artist in context; access-checked here.
 * @param roomId    - Optional chat room id, used in OAuth callback URLs.
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

    const sessions = await createToolRouterSessions({
      customerAccountId: accountId,
      artistId: effectiveArtistId,
      roomId,
    });

    const [customerTools, artistTools, sharedTools] = await Promise.all([
      collectTools(sessions.customer, name => META_TOOLS.has(name), "customer"),
      collectTools(sessions.artist, name => !META_TOOLS.has(name), "artist"),
      collectTools(sessions.shared, name => !META_TOOLS.has(name), "shared"),
    ]);

    return { ...customerTools, ...artistTools, ...sharedTools };
  } catch (error) {
    console.warn("Composio tools unavailable:", (error as Error).message);
    return {};
  }
}
