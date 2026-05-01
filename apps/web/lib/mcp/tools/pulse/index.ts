import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerGetPulsesTool } from "./registerGetPulsesTool";
import { registerUpdatePulseTool } from "./registerUpdatePulseTool";

/**
 * Registers all pulse-related MCP tools on the server.
 *
 * @param server - The MCP server instance to register tools on.
 */
export const registerAllPulseTools = (server: McpServer): void => {
  registerGetPulsesTool(server);
  registerUpdatePulseTool(server);
};
