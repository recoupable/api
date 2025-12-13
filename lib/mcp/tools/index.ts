import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerGetLocalTimeTool } from "./registerGetLocalTimeTool";
import { registerAllTaskTools } from "./tasks";
import { registerAllImageTools } from "./images";
import { registerAllCatalogTools } from "./catalogs";
import { registerAllSora2Tools } from "./sora2";
import { registerAllSpotifyTools } from "./spotify";
import { registerContactTeamTool } from "./registerContactTeamTool";
import { registerUpdateAccountInfoTool } from "./registerUpdateAccountInfoTool";
import { registerAllArtistSocialsTools } from "./artistSocials";
import { registerSearchWebTool } from "./registerSearchWebTool";
import { registerAllFileTools } from "./files";
import { registerCreateSegmentsTool } from "./registerCreateSegmentsTool";
import { registerAllYouTubeTools } from "./youtube";

/**
 * Registers all MCP tools on the server.
 * Add new tools here to automatically register them.
 *
 * @param server - The MCP server instance to register tools on.
 */
export const registerAllTools = (server: McpServer): void => {
  registerAllArtistSocialsTools(server);
  registerAllCatalogTools(server);
  registerAllFileTools(server);
  registerAllImageTools(server);
  registerAllSora2Tools(server);
  registerAllSpotifyTools(server);
  registerAllTaskTools(server);
  registerContactTeamTool(server);
  registerGetLocalTimeTool(server);
  registerSearchWebTool(server);
  registerUpdateAccountInfoTool(server);
  registerCreateSegmentsTool(server);
  registerAllYouTubeTools(server);
};
