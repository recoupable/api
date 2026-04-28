import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import {
  mcpUpdateTaskBodySchema,
  type McpUpdateTaskRequestBody,
} from "@/lib/tasks/updateTaskSchemas";
import { updateTask } from "@/lib/tasks/updateTask";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";

/**
 * Registers the "update_task" tool on the MCP server.
 * MCP is **personal context only**: no `account_id` body field; ownership is enforced via `resolvedAccountId`.
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
      inputSchema: mcpUpdateTaskBodySchema,
    },
    async (
      args: McpUpdateTaskRequestBody,
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
        const result = await updateTask({
          ...args,
          resolvedAccountId: accountId,
        });
        return getToolResultSuccess(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to update task";
        return getToolResultError(message);
      }
    },
  );
}
