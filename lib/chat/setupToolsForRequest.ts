import { ToolSet } from "ai";
import { filterExcludedTools } from "./filterExcludedTools";
import { ChatRequestBody } from "./validateChatRequest";
import { getMcpTools } from "@/lib/mcp/getMcpTools";
import { getComposioTools } from "@/lib/composio/toolRouter";

/**
 * Sets up and filters tools for a chat request.
 * Aggregates tools from:
 * - MCP server (via HTTP transport to /api/mcp for proper auth)
 * - Composio Tool Router (Google Sheets, Google Drive, Google Docs)
 *
 * @param body - The chat request body
 * @returns Filtered tool set ready for use
 */
export async function setupToolsForRequest(body: ChatRequestBody): Promise<ToolSet> {
  const { accountId, roomId, excludeTools, authToken } = body;

  // Only fetch MCP tools if we have an auth token
  const mcpTools = authToken ? await getMcpTools(authToken) : {};

  // Get Composio Tool Router tools (COMPOSIO_MANAGE_CONNECTIONS, etc.)
  const composioTools = await getComposioTools(accountId, roomId);

  // Merge all tools
  const allTools: ToolSet = {
    ...mcpTools,
    ...composioTools,
  };

  const tools = filterExcludedTools(allTools, excludeTools);
  return tools;
}
