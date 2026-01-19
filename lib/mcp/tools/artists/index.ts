import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCreateNewArtistTool } from "./registerCreateNewArtistTool";

/**
 * Registers all artist-related MCP tools on the server.
 *
 * @param server - The MCP server instance to register tools on.
 */
export const registerAllArtistTools = (server: McpServer): void => {
  registerCreateNewArtistTool(server);
};
