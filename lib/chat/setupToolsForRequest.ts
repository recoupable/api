import { ToolSet } from "ai";
import { filterExcludedTools } from "./filterExcludedTools";
import { ChatRequestBody } from "./validateChatRequest";
import { experimental_createMCPClient as createMCPClient } from "@ai-sdk/mcp";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

/**
 * Sets up and filters tools for a chat request.
 * This is a simplified version that returns an empty tool set.
 * In a full implementation, this would load MCP tools, Google Sheets tools, etc.
 *
 * @param body - The chat request body
 * @returns Filtered tool set ready for use
 */
export async function setupToolsForRequest(body: ChatRequestBody): Promise<ToolSet> {
  const { excludeTools } = body;

  const mcpClient = await createMCPClient({
    transport: new StreamableHTTPClientTransport(new URL("/mcp", "https://recoup-api.vercel.app")),
  });

  const mcpClientTools = (await mcpClient.tools()) as ToolSet;

  const allTools: ToolSet = { ...mcpClientTools };

  const tools = filterExcludedTools(allTools, excludeTools);
  return tools;
}
