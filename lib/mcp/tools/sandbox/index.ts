import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerRunSandboxCommandTool } from "./registerRunSandboxCommandTool";

/**
 * Registers all sandbox-related MCP tools on the server.
 *
 * @param server - The MCP server instance to register tools on.
 */
export const registerAllSandboxTools = (server: McpServer): void => {
  registerRunSandboxCommandTool(server);
};
