import { ToolSet } from "ai";
import { filterExcludedTools } from "./filterExcludedTools";
import { ChatRequestBody } from "./validateChatRequest";
import { experimental_createMCPClient as createMCPClient } from "@ai-sdk/mcp";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { getGoogleSheetsTools } from "@/lib/agents/googleSheetsAgent";

/**
 * Gets the base URL for the current environment.
 * Uses VERCEL_URL in Vercel deployments, falls back to localhost.
 *
 * @returns The base URL string
 */
function getBaseUrl(): string {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}

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

  let mcpClientTools: ToolSet = {};

  // Only fetch MCP tools if we have an auth token
  if (authToken) {
    const mcpUrl = new URL("/api/mcp", getBaseUrl());
    const transport = new StreamableHTTPClientTransport(mcpUrl, {
      requestInit: {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      },
    });

    const mcpClient = await createMCPClient({ transport });
    mcpClientTools = (await mcpClient.tools()) as ToolSet;
  }

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
