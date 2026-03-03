import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { selectPulseAccounts } from "@/lib/supabase/pulse_accounts/selectPulseAccounts";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { buildGetPulsesParams } from "@/lib/pulse/buildGetPulsesParams";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";

const getPulsesSchema = z.object({
  active: z.boolean().optional().describe("Filter by active status (true/false)."),
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
      const { active } = args;

      const authInfo = extra.authInfo as McpAuthInfo | undefined;
      const { accountId, error: authError } = await resolveAccountId({
        authInfo,
        accountIdOverride: undefined,
      });

      if (authError) {
        return getToolResultError(authError);
      }

      if (!accountId) {
        return getToolResultError("Failed to resolve account ID");
      }

      const orgId = authInfo?.extra?.orgId ?? null;

      const { params, error } = await buildGetPulsesParams({
        accountId,
        orgId,
        targetAccountId: undefined,
        active,
      });

      if (error) {
        return getToolResultError(error);
      }

      const pulses = await selectPulseAccounts(params);
      return getToolResultSuccess({ pulses });
    },
  );
}
