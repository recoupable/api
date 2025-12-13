import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerGetArtistSocialsTool } from "./registerGetArtistSocialsTool";
import { registerGetLocalTimeTool } from "./registerGetLocalTimeTool";
import { registerAllTaskTools } from "./tasks";
import { registerAllImageTools } from "./images";
import { registerAllCatalogTools } from "./catalogs";
import { registerAllSora2Tools } from "./sora2";
import { registerAllSpotifyTools } from "./spotify";
import { registerContactTeamTool } from "./registerContactTeamTool";
import { registerUpdateAccountInfoTool } from "./registerUpdateAccountInfoTool";

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
  registerAllSora2Tools(server);
  registerAllSpotifyTools(server);
  registerContactTeamTool(server);
  registerUpdateAccountInfoTool(server);
};
