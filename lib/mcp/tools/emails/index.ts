import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerSendEmailTool } from "./registerSendEmailTool";

/**
 * Registers all email-related MCP tools on the server.
 *
 * @param server - The MCP server instance to register tools on.
 */
export const registerAllEmailTools = (server: McpServer): void => {
  registerSendEmailTool(server);
};
