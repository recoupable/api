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
          apiKey: authInfo!.token,
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
