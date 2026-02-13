import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerRenderVideoTool } from "./registerRenderVideoTool";

/**
 * Registers all render-related MCP tools.
 *
 * @param server - The MCP server instance
 */
export function registerAllRenderTools(server: McpServer): void {
  registerRenderVideoTool(server);
}
