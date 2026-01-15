import { ToolSet } from "ai";
import { filterExcludedTools } from "./filterExcludedTools";
import { ChatRequestBody } from "./validateChatRequest";
import { experimental_createMCPClient as createMCPClient } from "@ai-sdk/mcp";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { getGoogleSheetsTools } from "@/lib/agents/googleSheetsAgent";

/** Base URL for the MCP server */
const MCP_BASE_URL = process.env.MCP_BASE_URL || "https://recoup-api.vercel.app";

/**
 * Sets up and filters tools for a chat request.
 * Aggregates tools from:
 * - MCP client (remote tools via MCP protocol)
 * - Google Sheets (via Composio integration)
 *
 * @param body - The chat request body
 * @returns Filtered tool set ready for use
 */
export async function setupToolsForRequest(body: ChatRequestBody): Promise<ToolSet> {
  const { excludeTools } = body;

  // Fetch MCP tools
  const mcpClient = await createMCPClient({
    transport: new StreamableHTTPClientTransport(new URL("/mcp", MCP_BASE_URL)),
  });
  const mcpClientTools = (await mcpClient.tools()) as ToolSet;

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
