import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPredictEngagementTool } from "./registerPredictEngagementTool";
import { registerGetPredictionsTool } from "./registerGetPredictionsTool";

/**
 * Registers all TRIBE v2 engagement prediction MCP tools.
 *
 * @param server - The MCP server instance.
 */
export function registerAllTribeTools(server: McpServer): void {
  registerPredictEngagementTool(server);
  registerGetPredictionsTool(server);
}
