import { createToolRouterSession } from "./createSession";

/**
 * Tool returned by Composio Tool Router.
 * Uses inputSchema (not parameters) which is MCP-compatible.
 */
export interface ComposioTool {
  description: string;
  inputSchema: unknown;
  execute: (args: unknown) => Promise<unknown>;
}

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
 * @returns Record of tool name to tool definition
 */
export async function getComposioTools(
  userId: string,
  roomId?: string,
): Promise<Record<string, ComposioTool>> {
  const session = await createToolRouterSession(userId, roomId);
  const allTools = (await session.tools()) as Record<string, ComposioTool>;

  // Filter to only allowed tools
  const filteredTools: Record<string, ComposioTool> = {};
  for (const toolName of ALLOWED_TOOLS) {
    if (allTools[toolName]) {
      filteredTools[toolName] = allTools[toolName];
    }
  }

  return filteredTools;
}
