import { ToolSet } from "ai";
import { filterExcludedTools } from "./filterExcludedTools";
import { ChatRequestBody } from "./validateChatRequest";
import { getMcpTools } from "@/lib/mcp/getMcpTools";
import { getComposioTools } from "@/lib/composio/toolRouter";

/**
 * Sets up and filters tools for a chat request.
 * Aggregates tools from:
 * - MCP server (via HTTP transport to /api/mcp for proper auth)
 * - Composio Tool Router (Google Sheets, Google Drive, Google Docs, TikTok)
 *
 * @param body - The chat request body
 * @returns Filtered tool set ready for use
 */
export async function setupToolsForRequest(body: ChatRequestBody): Promise<ToolSet> {
  const { accountId, artistId, roomId, excludeTools, authToken } = body;

  // Fetch MCP tools and Composio tools in parallel - they're independent
  const [mcpTools, composioTools] = await Promise.all([
    authToken ? getMcpTools(authToken) : Promise.resolve({}),
    getComposioTools(accountId, artistId, roomId),
  ]);

  // Merge all tools
  const allTools: ToolSet = {
    ...mcpTools,
    ...composioTools,
  };

  const tools = filterExcludedTools(allTools, excludeTools);
  return tools;
}
