import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import { upsertPulseAccount } from "@/lib/supabase/pulse_accounts/upsertPulseAccount";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";

const updatePulseSchema = z.object({
  active: z.boolean().describe("Whether pulse is active for this account"),
  account_id: z
    .string()
    .optional()
    .describe(
      "The account ID to update pulse status for. Only required for organization API keys updating on behalf of other accounts. " +
        "If not provided, the account ID will be resolved from the authenticated API key.",
    ),
});

export type UpdatePulseArgs = z.infer<typeof updatePulseSchema>;

/**
 * Registers the "update_pulse" tool on the MCP server.
 * Updates the pulse status for an account.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerUpdatePulseTool(server: McpServer): void {
  server.registerTool(
    "update_pulse",
    {
      description:
        "Update the pulse status for an account. " +
        "Requires authentication via API key (Authorization: Bearer header). " +
        "The account_id parameter is optional — only provide it when using an organization API key to update on behalf of other accounts.",
      inputSchema: updatePulseSchema,
    },
    async (
      args: UpdatePulseArgs,
      extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
    ) => {
      const { active, account_id } = args;

      const authInfo = extra.authInfo as McpAuthInfo | undefined;
      const { accountId, error } = await resolveAccountId({
        authInfo,
        accountIdOverride: account_id,
      });

      if (error) {
        return getToolResultError(error);
      }

      if (!accountId) {
        return getToolResultError("Failed to resolve account ID");
      }

      const pulseAccount = await upsertPulseAccount({ account_id: accountId, active });

      if (!pulseAccount) {
        return getToolResultError("Failed to update pulse status");
      }

      return getToolResultSuccess({ pulse: pulseAccount });
    },
  );
}
