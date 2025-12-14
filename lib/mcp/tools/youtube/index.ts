import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerYouTubeLoginTool } from "./registerYouTubeLoginTool";
import { registerGetYouTubeChannelsTool } from "./registerGetYouTubeChannelsTool";
import { registerGetYouTubeRevenueTool } from "./registerGetYouTubeRevenueTool";
import { registerGetYouTubeChannelVideoListTool } from "./registerGetYouTubeChannelVideoListTool";

/**
 * Registers all YouTube-related MCP tools on the server.
 *
 * @param server - The MCP server instance to register tools on.
 */
export const registerAllYouTubeTools = (server: McpServer): void => {
  registerYouTubeLoginTool(server);
  registerGetYouTubeChannelsTool(server);
  registerGetYouTubeRevenueTool(server);
  registerGetYouTubeChannelVideoListTool(server);
};
