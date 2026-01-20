import { ToolSet } from "ai";
import { filterExcludedTools } from "./filterExcludedTools";
import { ChatRequestBody } from "./validateChatRequest";
import { getGoogleSheetsTools } from "@/lib/agents/googleSheetsAgent";
import { getMcpTools } from "@/lib/mcp/getMcpTools";

/**
 * Sets up and filters tools for a chat request.
 * Aggregates tools from:
 * - MCP server (via HTTP transport to /api/mcp for proper auth)
 * - Google Sheets (via Composio integration)
 *
 * @param body - The chat request body
 * @returns Filtered tool set ready for use
 */
export async function setupToolsForRequest(body: ChatRequestBody): Promise<ToolSet> {
  const { excludeTools, authToken } = body;

  // Only fetch MCP tools if we have an auth token
  const mcpClientTools = authToken ? await getMcpTools(authToken) : {};

  // Fetch Google Sheets tools (authenticated tools or login tool)
  const googleSheetsTools = await getGoogleSheetsTools(body);

  // Merge all tools - Google Sheets tools take precedence over MCP tools
  const allTools: ToolSet = {
    ...mcpClientTools,
    ...googleSheetsTools,
  };

  const tools = filterExcludedTools(allTools, excludeTools);
  return tools;
}
