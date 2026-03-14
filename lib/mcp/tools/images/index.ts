import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerGenerateImageTool } from "./registerGenerateImageTool";
import { registerEditImageTool } from "./registerEditImageTool";

/**
 * Registers all image-related MCP tools on the server.
 *
 * @param server - The MCP server instance to register tools on.
 */
export const registerAllImageTools = (server: McpServer): void => {
  registerGenerateImageTool(server);
  registerEditImageTool(server);
};
