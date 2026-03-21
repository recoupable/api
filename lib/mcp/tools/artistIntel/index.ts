import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerGenerateArtistIntelPackTool } from "./registerGenerateArtistIntelPackTool";

/**
 * Registers all artist intelligence MCP tools on the server.
 *
 * @param server - The MCP server instance.
 */
export function registerAllArtistIntelTools(server: McpServer): void {
  registerGenerateArtistIntelPackTool(server);
}
