import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerGenerateVideoTool } from "./registerGenerateVideoTool";
import { registerRetrieveVideoTool } from "./registerRetrieveVideoTool";
import { registerRetrieveVideoContentTool } from "./registerRetrieveVideoContentTool";

/**
 * Registers all sora2-related MCP tools on the server.
 *
 * @param server - The MCP server instance to register tools on.
 */
export const registerAllSora2Tools = (server: McpServer): void => {
  registerGenerateVideoTool(server);
  registerRetrieveVideoTool(server);
  registerRetrieveVideoContentTool(server);
};
