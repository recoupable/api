import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { deleteTask } from "@/lib/tasks/deleteTask";
import { selectScheduledActions } from "@/lib/supabase/scheduled_actions/selectScheduledActions";
import { deleteTaskBodySchema, type DeleteTaskBody } from "@/lib/tasks/validateDeleteTaskBody";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";

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
    async (args: DeleteTaskBody, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      const authInfo = extra.authInfo as McpAuthInfo | undefined;
      const { accountId, error } = await resolveAccountId({
        authInfo,
        accountIdOverride: undefined,
      });

      if (error) {
        return getToolResultError(error);
      }

      if (!accountId) {
        return getToolResultError("Failed to resolve account ID");
      }

      // Fetch task before deletion so we can return it for display
      const tasks = await selectScheduledActions({ id: args.id });
      const taskToDelete = tasks.length > 0 ? tasks[0] : null;

      // Delete the task
      await deleteTask({
        id: args.id,
        resolvedAccountId: accountId,
      });

      return getToolResultSuccess(taskToDelete);
    },
  );
}
