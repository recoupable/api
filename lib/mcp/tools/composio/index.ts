import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerComposioTools } from "./registerComposioTools";

/**
 * Registers all Composio-related tools on the MCP server.
 *
 * Currently registers:
 * - composio: Meta-tool for accessing Composio Tool Router
 *
 * @param server - The MCP server instance to register tools on.
 */
export function registerAllComposioTools(server: McpServer): void {
  registerComposioTools(server);
}
