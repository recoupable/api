import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerGetCatalogsTool } from "./registerGetCatalogsTool";
import { registerGetCatalogSongsTool } from "./registerGetCatalogSongsTool";
import { registerInsertCatalogSongsTool } from "./registerInsertCatalogSongsTool";
import { registerGetCatalogPlaycountHistoryTool } from "./registerGetCatalogPlaycountHistoryTool";
import { registerCatalogStreamsTools } from "./registerCatalogStreamsTools";

/**
 * Registers all catalog-related MCP tools on the server.
 *
 * @param server - The MCP server instance to register tools on.
 */
export const registerAllCatalogTools = (server: McpServer): void => {
  registerGetCatalogsTool(server);
  registerGetCatalogSongsTool(server);
  registerInsertCatalogSongsTool(server);
  registerGetCatalogPlaycountHistoryTool(server);
  registerCatalogStreamsTools(server);
};
