import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerGetArtistSocialsTool } from "./registerGetArtistSocialsTool";
import { registerUpdateArtistSocialsTool } from "./registerUpdateArtistSocialsTool";
import { registerScrapeArtistSocialsTool } from "./registerScrapeArtistSocialsTool";
import { registerGetScraperResultsTool } from "./registerGetScraperResultsTool";
import { registerGetArtistPostsTool } from "./registerGetArtistPostsTool";

/**
 * Registers all artist socials and posts MCP tools on the server.
 *
 * @param server - The MCP server instance to register tools on.
 */
export const registerAllArtistSocialsTools = (server: McpServer): void => {
  registerGetArtistSocialsTool(server);
  registerUpdateArtistSocialsTool(server);
  registerScrapeArtistSocialsTool(server);
  registerGetScraperResultsTool(server);
  registerGetArtistPostsTool(server);
};
