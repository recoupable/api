import { createToolRouterSession } from "./createSession";
import { getComposioClient } from "../client";
import { ALLOWED_ARTIST_CONNECTORS } from "../artistConnectors/ALLOWED_ARTIST_CONNECTORS";
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
 * Query Composio for an artist's connected accounts.
 *
 * Uses artistId as the Composio entity to get their connections.
 * Only returns connections for ALLOWED_ARTIST_CONNECTORS (e.g., tiktok).
 *
 * @param artistId - The artist ID (Composio entity)
 * @returns Map of toolkit slug to connected account ID
 */
async function getArtistConnectionsFromComposio(
  artistId: string
): Promise<Record<string, string>> {
  const composio = await getComposioClient();

  // Create session with artistId as entity
  const session = await composio.create(artistId, {
    toolkits: ALLOWED_ARTIST_CONNECTORS,
  });

  // Get toolkits and extract connected account IDs
  const toolkits = await session.toolkits();
  const connections: Record<string, string> = {};

  for (const toolkit of toolkits.items) {
    const connectedAccountId = toolkit.connection?.connectedAccount?.id;
    if (connectedAccountId && ALLOWED_ARTIST_CONNECTORS.includes(toolkit.slug)) {
      connections[toolkit.slug] = connectedAccountId;
    }
  }

  return connections;
}

/**
 * Get Composio Tool Router tools for a user.
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
 * @param userId - Unique identifier for the user (accountId)
 * @param artistId - Optional artist ID to use artist-specific Composio connections
 * @param roomId - Optional chat room ID for OAuth redirect
 * @returns ToolSet containing filtered Vercel AI SDK tools
 */
export async function getComposioTools(
  userId: string,
  artistId?: string,
  roomId?: string
): Promise<ToolSet> {
  // Skip Composio if API key is not configured
  if (!process.env.COMPOSIO_API_KEY) {
    return {};
  }

  try {
    // Fetch artist-specific connections from Composio if artistId is provided
    let artistConnections: Record<string, string> | undefined;
    if (artistId) {
      artistConnections = await getArtistConnectionsFromComposio(artistId);
      // Only pass if there are actual connections
      if (Object.keys(artistConnections).length === 0) {
        artistConnections = undefined;
      }
    }

    const session = await createToolRouterSession(userId, roomId, artistConnections);
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
