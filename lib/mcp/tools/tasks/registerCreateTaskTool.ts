import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createTask } from "@/lib/tasks/createTask";
import { createTaskBodySchema, type CreateTaskBody } from "@/lib/tasks/validateCreateTaskBody";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";

/**
 * Registers the "create_task" tool on the MCP server.
 * Creates a new task in the system. A task represents a scheduled action that will be executed on a schedule.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerCreateTaskTool(server: McpServer): void {
  server.registerTool(
    "create_task",
    {
      description: `Create a new task.`,
      inputSchema: createTaskBodySchema,
    },
    async (args: CreateTaskBody) => {
      const result = await createTask(args);
      return getToolResultSuccess(result);
    },
  );
}
