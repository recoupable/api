import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerGetRandomNumberTool } from "./registerGetRandomNumberTool";
import { registerGetArtistSocialsTool } from "./registerGetArtistSocialsTool";

/**
 * Registers all MCP tools on the server.
 * Add new tools here to automatically register them.
 *
 * @param server - The MCP server instance to register tools on.
 */
export const registerAllTools = (server: McpServer): void => {
  registerGetRandomNumberTool(server);
  registerGetArtistSocialsTool(server);
};
