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
 * Why: The Composio SDK's session.tools() returns a ToolSet (Record<string, Tool>)
 * from the configured provider. With VercelProvider, this returns Vercel AI SDK tools.
 * We validate at runtime to ensure type safety before using bracket notation access.
 *
 * @param tool - The object to validate
 * @returns true if the object has required Tool properties
 */
function isValidTool(tool: unknown): tool is Tool {
  if (typeof tool !== "object" || tool === null) {
    return false;
  }

  const obj = tool as Record<string, unknown>;

  // Vercel AI SDK Tool requires: description (optional), parameters, execute
  // The execute function is what makes it callable
  const hasExecute = typeof obj.execute === "function";
  const hasParameters = "parameters" in obj;

  return hasExecute && hasParameters;
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
 * @param userId - Unique identifier for the user (accountId)
 * @param roomId - Optional chat room ID for OAuth redirect
 * @returns ToolSet containing filtered Vercel AI SDK tools
 */
export async function getComposioTools(
  userId: string,
  roomId?: string
): Promise<ToolSet> {
  const session = await createToolRouterSession(userId, roomId);
  const allTools = await session.tools();

  // Filter to only allowed tools with runtime validation
  const filteredTools: ToolSet = {};

  for (const toolName of ALLOWED_TOOLS) {
    // Use Object.prototype.hasOwnProperty to safely check for property existence
    // This handles both plain objects and class instances safely
    if (Object.prototype.hasOwnProperty.call(allTools, toolName)) {
      const tool = (allTools as Record<string, unknown>)[toolName];

      if (isValidTool(tool)) {
        filteredTools[toolName] = tool;
      }
    }
  }

  return filteredTools;
}
