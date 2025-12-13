import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerYouTubeLoginTool } from "./registerYouTubeLoginTool";

/**
 * Registers all YouTube-related MCP tools on the server.
 *
 * @param server - The MCP server instance to register tools on.
 */
export const registerAllYouTubeTools = (server: McpServer): void => {
  registerYouTubeLoginTool(server);
};
