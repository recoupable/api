import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerRunSandboxCommandTool } from "./registerRunSandboxCommandTool";

/**
 * Registers all sandbox-related MCP tools on the server.
 * Note: prompt_sandbox is now a local streaming tool in setupToolsForRequest.
 *
 * @param server - The MCP server instance to register tools on.
 */
export const registerAllSandboxTools = (server: McpServer): void => {
  registerRunSandboxCommandTool(server);
};
