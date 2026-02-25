import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { promptSandbox } from "@/lib/sandbox/promptSandbox";

const promptSandboxSchema = z.object({
  prompt: z
    .string()
    .min(1)
    .describe("The prompt to send to OpenClaw running in the sandbox."),
  account_id: z
    .string()
    .optional()
    .describe(
      "The account ID to run the prompt for. Only applicable for organization API keys — org keys can target any account within their organization. Do not use with personal API keys.",
    ),
});

/**
 * Registers the "prompt_sandbox" tool on the MCP server.
 * Sends a prompt to OpenClaw in a persistent per-account sandbox and returns the output.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerPromptSandboxTool(server: McpServer): void {
  server.registerTool(
    "prompt_sandbox",
    {
      description:
        "Send a prompt to OpenClaw running in a persistent sandbox. Reuses the account's existing running sandbox or creates one from the latest snapshot. Returns raw stdout/stderr. The sandbox stays alive for follow-up prompts.",
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
        const result = await promptSandbox({
          accountId,
          prompt: args.prompt,
        });

        return getToolResultSuccess(result);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to prompt sandbox";
        return getToolResultError(message);
      }
    },
  );
}
