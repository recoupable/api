import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { retrieveTaskRun } from "@/lib/trigger/retrieveTaskRun";

const getTaskRunStatusSchema = z.object({
  runId: z.string().describe("The unique identifier of the task run to check."),
});

/**
 * Registers the "get_task_run_status" tool on the MCP server.
 * Retrieves the status of a Trigger.dev task run.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerGetTaskRunStatusTool(server: McpServer): void {
  server.registerTool(
    "get_task_run_status",
    {
      description:
        "Get the status of a task run by its run ID. Returns status, metadata, logs, and timestamps.",
      inputSchema: getTaskRunStatusSchema,
    },
    async (args, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
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
        const result = await retrieveTaskRun(args.runId);

        if (!result) {
          return getToolResultError(`Task run with ID "${args.runId}" not found.`);
        }

        return getToolResultSuccess(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to retrieve task run";
        return getToolResultError(message);
      }
    },
  );
}
