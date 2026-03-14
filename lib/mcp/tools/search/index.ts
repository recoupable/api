import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerSearchWebTool } from "./registerSearchWebTool";
import { registerSearchGoogleImagesTool } from "./registerSearchGoogleImagesTool";

/**
 * Registers all search-related MCP tools on the server.
 *
 * @param server - The MCP server instance to register tools on.
 */
export const registerAllSearchTools = (server: McpServer): void => {
  registerSearchWebTool(server);
  registerSearchGoogleImagesTool(server);
};
