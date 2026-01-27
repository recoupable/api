import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import { selectPulseAccount } from "@/lib/supabase/pulse_accounts/selectPulseAccount";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";

const getPulseSchema = z.object({
  account_id: z
    .string()
    .optional()
    .describe(
      "The account ID to get pulse status for. Only required for organization API keys querying on behalf of other accounts. " +
        "If not provided, the account ID will be resolved from the authenticated API key.",
    ),
});

export type GetPulseArgs = z.infer<typeof getPulseSchema>;

/**
 * Registers the "get_pulse" tool on the MCP server.
 * Retrieves the pulse status for an account.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerGetPulseTool(server: McpServer): void {
  server.registerTool(
    "get_pulse",
    {
      description:
        "Get the pulse status for an account. " +
        "Requires authentication via API key (Authorization: Bearer header). " +
        "The account_id parameter is optional — only provide it when using an organization API key to query on behalf of other accounts.",
      inputSchema: getPulseSchema,
    },
    async (args: GetPulseArgs, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      const { account_id } = args;

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

      const pulseAccount = await selectPulseAccount(accountId);

      return getToolResultSuccess({
        pulse: pulseAccount ?? { id: null, account_id: accountId, active: false },
      });
    },
  );
}
