import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerGetSpotifySearchTool } from "./registerGetSpotifySearchTool";
import { registerGetSpotifyArtistTopTracksTool } from "./registerGetSpotifyArtistTopTracksTool";
import { registerGetSpotifyArtistAlbumsTool } from "./registerGetSpotifyArtistAlbumsTool";

/**
 * Registers all Spotify-related MCP tools on the server.
 *
 * @param server - The MCP server instance to register tools on.
 */
export const registerAllSpotifyTools = (server: McpServer): void => {
  registerGetSpotifySearchTool(server);
  registerGetSpotifyArtistTopTracksTool(server);
  registerGetSpotifyArtistAlbumsTool(server);
};
