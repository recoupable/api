import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerGetYouTubeRevenueTool } from "./registerGetYouTubeRevenueTool";

/**
 * Registers all YouTube-related MCP tools on the server.
 *
 * Channel info, playlist videos, and thumbnail upload are served by
 * Composio's YouTube toolkit (YOUTUBE_GET_CHANNEL_STATISTICS,
 * YOUTUBE_LIST_PLAYLIST_ITEMS, YOUTUBE_UPDATE_THUMBNAIL) via the
 * shared `getComposioTools` path. Only revenue stays here because
 * Composio doesn't expose YouTube Analytics.
 *
 * @param server - The MCP server instance to register tools on.
 */
export const registerAllYouTubeTools = (server: McpServer): void => {
  registerGetYouTubeRevenueTool(server);
};
