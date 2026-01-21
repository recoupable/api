import { createToolRouterSession } from "./createSession";
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
 * Get Composio Tool Router tools for a user.
 *
 * Returns a filtered subset of meta-tools:
 * - COMPOSIO_MANAGE_CONNECTIONS - OAuth/auth management
 * - COMPOSIO_SEARCH_TOOLS - Find available connectors
 * - COMPOSIO_GET_TOOL_SCHEMAS - Get parameter schemas
 * - COMPOSIO_MULTI_EXECUTE_TOOL - Execute actions
 *
 * Gracefully returns empty ToolSet when:
 * - COMPOSIO_API_KEY is not set
 * - @composio packages fail to load (bundler incompatibility)
 *
 * @param userId - Unique identifier for the user (accountId)
 * @param roomId - Optional chat room ID for OAuth redirect
 * @returns ToolSet containing filtered Vercel AI SDK tools
 */
export async function getComposioTools(
  userId: string,
  roomId?: string
): Promise<ToolSet> {
  // Skip Composio if API key is not configured
  if (!process.env.COMPOSIO_API_KEY) {
    return {};
  }

  try {
    const session = await createToolRouterSession(userId, roomId);
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
