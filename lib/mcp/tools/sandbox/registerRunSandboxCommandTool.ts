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
  command: z
    .string()
    .optional()
    .describe("The command to run in the sandbox. Cannot be used with prompt."),
  args: z.array(z.string()).optional().describe("Arguments for the command."),
  cwd: z.string().optional().describe("Working directory for the command."),
  prompt: z
    .string()
    .optional()
    .describe(
      'A prompt to pass to OpenClaw. Runs `openclaw agent --agent main --message "<prompt>"` in the sandbox. Cannot be used with command.',
    ),
  account_id: z
    .string()
    .optional()
    .describe(
      "The account ID to run the sandbox command for. Only applicable for organization API keys — org keys can target any account within their organization. Do not use with personal API keys.",
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
        'Create a sandbox and run a command or OpenClaw prompt in it. Use prompt to run `openclaw agent --agent main --message "<prompt>"`. Returns the sandbox ID and a run ID to track progress.',
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
          prompt: args.prompt,
        });

        return getToolResultSuccess(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to create sandbox";
        return getToolResultError(message);
      }
    },
  );
}
