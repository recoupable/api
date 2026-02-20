import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAnalyzeMusicTool } from "./registerAnalyzeMusicTool";

/**
 * Registers all flamingo-related MCP tools.
 *
 * @param server - The MCP server instance
 */
export function registerAllFlamingoTools(server: McpServer): void {
  registerAnalyzeMusicTool(server);
}
