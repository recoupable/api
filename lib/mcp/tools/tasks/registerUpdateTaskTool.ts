import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { updateTask } from "@/lib/tasks/updateTask";
import { updateTaskBodySchema, type UpdateTaskBody } from "@/lib/tasks/validateUpdateTaskBody";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";

/**
 * Registers the "update_task" tool on the MCP server.
 * Updates an existing task in the system. Only the id field is required; any additional fields will be updated.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerUpdateTaskTool(server: McpServer): void {
  server.registerTool(
    "update_task",
    {
      description: `Update an existing task in the system. Only the id field is required; 
any additional fields you include will be updated on the task.
Omitting a field leaves the existing value unchanged.`,
      inputSchema: updateTaskBodySchema,
    },
    async (args: UpdateTaskBody) => {
      const result = await updateTask(args);
      return getToolResultSuccess(result);
    },
  );
}
