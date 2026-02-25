import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPromptSandboxTool } from "./registerPromptSandboxTool";
import { registerRunSandboxCommandTool } from "./registerRunSandboxCommandTool";

/**
 * Registers all sandbox-related MCP tools on the server.
 *
 * @param server - The MCP server instance to register tools on.
 */
export const registerAllSandboxTools = (server: McpServer): void => {
  registerPromptSandboxTool(server);
  registerRunSandboxCommandTool(server);
};
