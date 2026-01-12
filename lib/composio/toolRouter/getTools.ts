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
 * Get Composio Tool Router tools for a user.
 *
 * Returns 6 meta-tools:
 * - COMPOSIO_MANAGE_CONNECTIONS - OAuth/auth management
 * - COMPOSIO_SEARCH_TOOLS - Find available connectors
 * - COMPOSIO_GET_TOOL_SCHEMAS - Get parameter schemas
 * - COMPOSIO_MULTI_EXECUTE_TOOL - Execute actions
 * - COMPOSIO_REMOTE_BASH_TOOL - Remote bash
 * - COMPOSIO_REMOTE_WORKBENCH - Workbench
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
  const tools = await session.tools();
  return tools as Record<string, ComposioTool>;
}
