import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerGetArtistSocialsTool } from "./registerGetArtistSocialsTool";
import { registerUpdateArtistSocialsTool } from "./registerUpdateArtistSocialsTool";

/**
 * Registers all artist socials-related MCP tools on the server.
 *
 * @param server - The MCP server instance to register tools on.
 */
export const registerAllArtistSocialsTools = (server: McpServer): void => {
  registerGetArtistSocialsTool(server);
  registerUpdateArtistSocialsTool(server);
};
