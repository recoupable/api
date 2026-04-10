import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import { createTask } from "@/lib/tasks/createTask";
import {
  createTaskBodySchema,
  type CreateTaskRequestBody,
} from "@/lib/tasks/validateCreateTaskBody";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";

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
    async (
      args: CreateTaskRequestBody,
      extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
    ) => {
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

      const result = await createTask({ ...args, account_id: accountId });
      return getToolResultSuccess(result);
    },
  );
}
