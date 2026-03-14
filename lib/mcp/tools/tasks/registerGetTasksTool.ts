import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { selectScheduledActions } from "@/lib/supabase/scheduled_actions/selectScheduledActions";
import { GetTasksQuery, getTasksQuerySchema } from "@/lib/tasks/validateGetTasksQuery";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";

/**
 * Registers the "get_tasks" tool on the MCP server.
 * Retrieves tasks from the system. Can filter by account_id, artist_account_id, enabled status, and id.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerGetTasksTool(server: McpServer): void {
  server.registerTool(
    "get_tasks",
    {
      description: `Get tasks.`,
      inputSchema: getTasksQuerySchema,
    },
    async (args: GetTasksQuery) => {
      const tasks = await selectScheduledActions(args);
      return getToolResultSuccess(tasks);
    },
  );
}
