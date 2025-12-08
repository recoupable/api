import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerGetArtistSocialsTool } from "./registerGetArtistSocialsTool";
import { registerGetLocalTimeTool } from "./registerGetLocalTimeTool";
import { registerAllTaskTools } from "./tasks";
import { registerAllImageTools } from "./images";
import { registerAllCatalogTools } from "./catalogs";

/**
 * Registers all MCP tools on the server.
 * Add new tools here to automatically register them.
 *
 * @param server - The MCP server instance to register tools on.
 */
export const registerAllTools = (server: McpServer): void => {
  registerGetArtistSocialsTool(server);
  registerGetLocalTimeTool(server);
  registerAllTaskTools(server);
  registerAllImageTools(server);
  registerAllCatalogTools(server);
};
