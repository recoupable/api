import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerGetArtistSocialsTool } from "./registerGetArtistSocialsTool";
import { registerGetLocalTimeTool } from "./registerGetLocalTimeTool";

/**
 * Registers all MCP tools on the server.
 * Add new tools here to automatically register them.
 *
 * @param server - The MCP server instance to register tools on.
 */
export const registerAllTools = (server: McpServer): void => {
  registerGetArtistSocialsTool(server);
  registerGetLocalTimeTool(server);
};
