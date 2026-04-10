import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import { createTask } from "@/lib/tasks/createTask";
import {
  mcpCreateTaskBodySchema,
  type McpCreateTaskRequestBody,
} from "@/lib/tasks/createTaskSchemas";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";

/**
 * Registers the "create_task" tool on the MCP server.
 * MCP is **personal context only**: `resolveAccountId` is called with no account override (REST may still send optional `account_id`).
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerCreateTaskTool(server: McpServer): void {
  server.registerTool(
    "create_task",
    {
      description: `Create a new task.`,
      inputSchema: mcpCreateTaskBodySchema,
    },
    async (
      args: McpCreateTaskRequestBody,
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

      try {
        const result = await createTask({ ...args, account_id: accountId });
        return getToolResultSuccess(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to create task";
        return getToolResultError(message);
      }
    },
  );
}
