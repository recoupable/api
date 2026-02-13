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
import { registerAllSearchTools } from "./search";
import { registerWebDeepResearchTool } from "./registerWebDeepResearchTool";
import { registerArtistDeepResearchTool } from "./registerArtistDeepResearchTool";
import { registerAllFileTools } from "./files";
import { registerCreateSegmentsTool } from "./registerCreateSegmentsTool";
import { registerAllYouTubeTools } from "./youtube";
import { registerTranscribeTools } from "./transcribe";
import { registerSendEmailTool } from "./registerSendEmailTool";
import { registerAllArtistTools } from "./artists";
import { registerAllChatsTools } from "./chats";
import { registerAllPulseTools } from "./pulse";
import { registerAllRenderTools } from "./render";

/**
 * Registers all MCP tools on the server.
 * Add new tools here to automatically register them.
 *
 * Note: Composio tools are added directly in setupToolsForRequest,
 * not via MCP, because they are Vercel AI SDK tools from the Tool Router.
 *
 * @param server - The MCP server instance to register tools on.
 */
export const registerAllTools = (server: McpServer): void => {
  registerAllArtistTools(server);
  registerAllArtistSocialsTools(server);
  registerAllCatalogTools(server);
  registerAllChatsTools(server);
  registerAllFileTools(server);
  registerAllImageTools(server);
  registerAllPulseTools(server);
  registerAllRenderTools(server);
  registerAllSearchTools(server);
  registerAllSora2Tools(server);
  registerAllSpotifyTools(server);
  registerAllTaskTools(server);
  registerTranscribeTools(server);
  registerContactTeamTool(server);
  registerGetLocalTimeTool(server);
  registerWebDeepResearchTool(server);
  registerArtistDeepResearchTool(server);
  registerSendEmailTool(server);
  registerUpdateAccountInfoTool(server);
  registerCreateSegmentsTool(server);
  registerAllYouTubeTools(server);
};
