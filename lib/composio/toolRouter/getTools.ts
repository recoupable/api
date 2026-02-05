import { createToolRouterSession } from "./createToolRouterSession";
import { getArtistConnectionsFromComposio } from "./getArtistConnectionsFromComposio";
import { checkAccountArtistAccess } from "@/lib/supabase/account_artist_ids/checkAccountArtistAccess";
import type { Tool, ToolSet } from "ai";

/**
 * Tools we want to expose from Composio Tool Router.
 * Once we're ready to add all tools, remove this filter.
 */
const ALLOWED_TOOLS = [
  "COMPOSIO_MANAGE_CONNECTIONS",
  "COMPOSIO_SEARCH_TOOLS",
  "COMPOSIO_GET_TOOL_SCHEMAS",
  "COMPOSIO_MULTI_EXECUTE_TOOL",
];

/**
 * Runtime validation to check if an object is a valid Vercel AI SDK Tool.
 *
 * Composio SDK returns tools with { description, inputSchema, execute }
 * Vercel AI SDK also accepts inputSchema as an alias for parameters.
 *
 * @param tool - The object to validate
 * @returns true if the object has required Tool properties
 */
function isValidTool(tool: unknown): tool is Tool {
  if (typeof tool !== "object" || tool === null) {
    return false;
  }

  const obj = tool as Record<string, unknown>;

  // Tool needs execute function and either parameters or inputSchema
  const hasExecute = typeof obj.execute === "function";
  const hasSchema = "parameters" in obj || "inputSchema" in obj;

  return hasExecute && hasSchema;
}

/**
 * Get Composio Tool Router tools for an account.
 *
 * Returns a filtered subset of meta-tools:
 * - COMPOSIO_MANAGE_CONNECTIONS - OAuth/auth management
 * - COMPOSIO_SEARCH_TOOLS - Find available connectors
 * - COMPOSIO_GET_TOOL_SCHEMAS - Get parameter schemas
 * - COMPOSIO_MULTI_EXECUTE_TOOL - Execute actions
 *
 * If artistId is provided, queries Composio for the artist's connections
 * and passes them to the session via connectedAccounts override.
 *
 * Gracefully returns empty ToolSet when:
 * - COMPOSIO_API_KEY is not set
 * - @composio packages fail to load (bundler incompatibility)
 *
 * @param accountId - Unique identifier for the account
 * @param artistId - Optional artist ID to use artist-specific Composio connections
 * @param roomId - Optional chat room ID for OAuth redirect
 * @returns ToolSet containing filtered Vercel AI SDK tools
 */
export async function getComposioTools(
  accountId: string,
  artistId?: string,
  roomId?: string,
): Promise<ToolSet> {
  // Skip Composio if API key is not configured
  if (!process.env.COMPOSIO_API_KEY) {
    return {};
  }

  try {
    // Fetch artist-specific connections from Composio if artistId is provided
    // Only fetch if the account has access to this artist
    let artistConnections: Record<string, string> | undefined;
    if (artistId) {
      const hasAccess = await checkAccountArtistAccess(accountId, artistId);
      if (hasAccess) {
        artistConnections = await getArtistConnectionsFromComposio(artistId);
        // Only pass if there are actual connections
        if (Object.keys(artistConnections).length === 0) {
          artistConnections = undefined;
        }
      }
      // If no access, silently skip artist connections (don't throw)
    }

    const session = await createToolRouterSession(accountId, roomId, artistConnections);
    const allTools = await session.tools();

    // Filter to only allowed tools with runtime validation
    const filteredTools: ToolSet = {};

    for (const toolName of ALLOWED_TOOLS) {
      if (toolName in allTools) {
        const tool = (allTools as Record<string, unknown>)[toolName];

        if (isValidTool(tool)) {
          filteredTools[toolName] = tool;
        }
      }
    }

    return filteredTools;
  } catch (error) {
    // Gracefully handle Composio loading failures
    // (e.g., bundler incompatibility with createRequire(import.meta.url))
    console.warn("Composio tools unavailable:", (error as Error).message);
    return {};
  }
}
