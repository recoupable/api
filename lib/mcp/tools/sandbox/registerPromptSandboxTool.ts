import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { processCreateSandbox } from "@/lib/sandbox/processCreateSandbox";

const promptSandboxSchema = z.object({
  prompt: z
    .string()
    .describe(
      'A prompt to pass to OpenClaw. Runs `openclaw agent --agent main --message "<prompt>"` in the sandbox.',
    ),
  account_id: z
    .string()
    .optional()
    .describe(
      "The account ID to run the sandbox command for. Only applicable for organization API keys — org keys can target any account within their organization. Do not use with personal API keys.",
    ),
});

/**
 * Registers the "prompt_sandbox" tool on the MCP server.
 * Creates a sandbox and runs an OpenClaw prompt in it.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerPromptSandboxTool(server: McpServer): void {
  server.registerTool(
    "prompt_sandbox",
    {
      description:
        'Create a sandbox and run an OpenClaw prompt in it. Runs `openclaw agent --agent main --message "<prompt>"`. Returns the sandbox ID and a run ID to track progress.',
      inputSchema: promptSandboxSchema,
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
