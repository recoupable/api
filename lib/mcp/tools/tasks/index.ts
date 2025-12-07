import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCreateTaskTool } from "./registerCreateTaskTool";
import { registerGetTasksTool } from "./registerGetTasksTool";
import { registerUpdateTaskTool } from "./registerUpdateTaskTool";
import { registerDeleteTaskTool } from "./registerDeleteTaskTool";

/**
 * Registers all task-related MCP tools on the server.
 *
 * @param server - The MCP server instance to register tools on.
 */
export const registerAllTaskTools = (server: McpServer): void => {
  registerCreateTaskTool(server);
  registerGetTasksTool(server);
  registerUpdateTaskTool(server);
  registerDeleteTaskTool(server);
};
