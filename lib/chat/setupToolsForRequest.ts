import { ToolSet } from "ai";
import { filterExcludedTools } from "./filterExcludedTools";
import { ChatRequestBody } from "./validateChatRequest";
import { experimental_createMCPClient as createMCPClient } from "@ai-sdk/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerAllTools } from "@/lib/mcp/tools";
import { getGoogleSheetsTools } from "@/lib/agents/googleSheetsAgent";
import { AuthenticatedInMemoryTransport } from "@/lib/mcp/AuthenticatedInMemoryTransport";

/**
 * Sets up and filters tools for a chat request.
 * Aggregates tools from:
 * - MCP server (in-process via in-memory transport, no HTTP overhead)
 * - Google Sheets (via Composio integration)
 *
 * @param body - The chat request body
 * @returns Filtered tool set ready for use
 */
export async function setupToolsForRequest(body: ChatRequestBody): Promise<ToolSet> {
  const { excludeTools, accountId } = body;

  // Create in-memory MCP server and client (no HTTP call needed)
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  const server = new McpServer({
    name: "recoup-mcp",
    version: "0.0.1",
  });
  registerAllTools(server);
  await server.connect(serverTransport);

  // Wrap client transport to inject auth info into every message
  const authInfo = {
    token: "internal",
    scopes: ["mcp:tools"],
    clientId: accountId,
    extra: {
      accountId,
      orgId: null,
    },
  };
  const authenticatedTransport = new AuthenticatedInMemoryTransport(clientTransport, authInfo);

  const mcpClient = await createMCPClient({ transport: authenticatedTransport });
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
