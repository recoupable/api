import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import {
  selectPulseAccounts,
  type SelectPulseAccountsParams,
} from "@/lib/supabase/pulse_accounts/selectPulseAccounts";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { RECOUP_ORG_ID } from "@/lib/const";

const getPulsesSchema = z.object({
  account_id: z.string().optional().describe("The account ID to get pulse status for."),
});

export type GetPulsesArgs = z.infer<typeof getPulsesSchema>;

/**
 * Registers the "get_pulses" tool on the MCP server.
 * Retrieves pulse statuses for accounts.
 *
 * For personal keys: Returns pulses for the key owner's account.
 * For org keys: Returns pulses for all accounts in the organization.
 * For Recoup admin key: Returns ALL pulse records.
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
      const orgId = authInfo?.extra?.orgId ?? null;

      // If account_id override is provided, validate access and filter by that account
      if (account_id) {
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
      }

      // No account_id override - determine filter based on key type
      const authAccountId = authInfo?.extra?.accountId;

      if (!authAccountId) {
        return getToolResultError(
          "Authentication required. Provide an API key via Authorization: Bearer header, or provide account_id from the system prompt context.",
        );
      }

      let params: SelectPulseAccountsParams;

      if (orgId === RECOUP_ORG_ID) {
        // Recoup admin: return ALL pulse records
        params = {};
      } else if (orgId) {
        // Org key: filter by org membership
        params = { orgId };
      } else {
        // Personal key: filter by the key owner's account
        params = { accountIds: [authAccountId] };
      }

      const pulses = await selectPulseAccounts(params);
      return getToolResultSuccess({ pulses });
    },
  );
}
