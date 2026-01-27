import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import { selectPulseAccounts } from "@/lib/supabase/pulse_accounts/selectPulseAccounts";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";

const getPulsesSchema = z.object({
  account_id: z.string().optional().describe("The account ID to get pulse status for."),
});

export type GetPulsesArgs = z.infer<typeof getPulsesSchema>;

/**
 * Registers the "get_pulses" tool on the MCP server.
 * Retrieves pulse statuses for accounts.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerGetPulsesTool(server: McpServer): void {
  server.registerTool(
    "get_pulses",
    {
      description: "Get pulse statuses for accounts.",
      inputSchema: getPulsesSchema,
    },
    async (args: GetPulsesArgs, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
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

      const pulses = await selectPulseAccounts({ accountIds: [accountId] });

      return getToolResultSuccess({ pulses });
    },
  );
}
