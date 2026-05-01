import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerGetYouTubeRevenueTool } from "./registerGetYouTubeRevenueTool";

/**
 * Registers YouTube MCP tools. Only revenue stays custom because
 * Composio's YouTube toolkit doesn't expose YouTube Analytics.
 */
export const registerAllYouTubeTools = (server: McpServer): void => {
  registerGetYouTubeRevenueTool(server);
};
