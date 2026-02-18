import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { processCreateSandbox } from "@/lib/sandbox/processCreateSandbox";

const runSandboxCommandSchema = z.object({
  command: z.string().describe("The command to run in the sandbox."),
  args: z.array(z.string()).optional().describe("Arguments for the command."),
  cwd: z.string().optional().describe("Working directory for the command."),
  account_id: z
    .string()
    .optional()
    .describe(
      "The account ID to run the sandbox command for. Use the account_id from the system prompt context.",
    ),
});

/**
 * Registers the "run_sandbox_command" tool on the MCP server.
 * Creates a sandbox and runs a command in it.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerRunSandboxCommandTool(server: McpServer): void {
  server.registerTool(
    "run_sandbox_command",
    {
      description:
        "Create a sandbox and run a command in it. Returns the sandbox ID and a run ID to track progress.",
      inputSchema: runSandboxCommandSchema,
    },
    async (args, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      const authInfo = extra.authInfo as McpAuthInfo | undefined;
      const { accountId, error } = await resolveAccountId({
        authInfo,
        accountIdOverride: args.account_id,
      });

      if (error) {
        return getToolResultError(error);
      }

      if (!accountId) {
        return getToolResultError("Failed to resolve account ID");
      }

      try {
        const result = await processCreateSandbox({
          accountId,
          command: args.command,
          args: args.args,
          cwd: args.cwd,
        });

        return getToolResultSuccess(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to create sandbox";
        return getToolResultError(message);
      }
    },
  );
}
