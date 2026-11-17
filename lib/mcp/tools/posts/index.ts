import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerGetPublishedPostsTool } from "./registerGetPublishedPostsTool";
import { registerGetPublishedPostStatsTool } from "./registerGetPublishedPostStatsTool";

/**
 * Registers the published posts MCP tools on the server.
 *
 * @param server - The MCP server instance to register tools on.
 */
export const registerAllPostsTools = (server: McpServer): void => {
  registerGetPublishedPostsTool(server);
  registerGetPublishedPostStatsTool(server);
};
