import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { deleteTask } from "@/lib/tasks/deleteTask";
import { selectScheduledActions } from "@/lib/supabase/scheduled_actions/selectScheduledActions";
import { deleteTaskBodySchema, type DeleteTaskBody } from "@/lib/tasks/validateDeleteTaskBody";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";

/**
 * Registers the "delete_task" tool on the MCP server.
 * Deletes a task from the system. Requires the task ID to delete.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerDeleteTaskTool(server: McpServer): void {
  server.registerTool(
    "delete_task",
    {
      description: `Delete a task.`,
      inputSchema: deleteTaskBodySchema,
    },
    async (args: DeleteTaskBody) => {
      // Fetch task before deletion so we can return it for display
      const tasks = await selectScheduledActions({ id: args.id });
      const taskToDelete = tasks.length > 0 ? tasks[0] : null;

      // Delete the task
      await deleteTask(args);

      return getToolResultSuccess(taskToDelete);
    },
  );
}
