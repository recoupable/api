import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCreateKnowledgeBaseTool } from "./registerCreateKnowledgeBaseTool";
import { registerGenerateTxtFileTool } from "./registerGenerateTxtFileTool";

/**
 * Registers all file-related MCP tools on the server.
 *
 * @param server - The MCP server instance to register tools on.
 */
export const registerAllFileTools = (server: McpServer): void => {
  registerCreateKnowledgeBaseTool(server);
  registerGenerateTxtFileTool(server);
};
