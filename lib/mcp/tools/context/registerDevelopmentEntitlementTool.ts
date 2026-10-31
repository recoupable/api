import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { developmentEntitlementSchema } from "@/lib/context/entitlements/developmentEntitlementSchema";
import { dispatchDevelopmentEntitlement } from "@/lib/context/entitlements/dispatchDevelopmentEntitlement";
/** Register only for explicitly enabled development; delegated OAuth excludes this name. */
export function registerDevelopmentEntitlementTool(server: McpServer) {
  if (process.env.NODE_ENV !== "development" || process.env.CATALOG_ENTITLEMENT_DEV !== "true")
    return;
  server.registerTool(
    "dev_calculate_catalog_entitlements",
    {
      description:
        "Development-only calculation from a current authorized case assessment. Supplied terms remain assertions; no persistence or external action.",
      inputSchema: developmentEntitlementSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async (args, extra) => {
      const result = await dispatchDevelopmentEntitlement(
        async () => args,
        async () => {
          const authInfo = extra.authInfo as McpAuthInfo | undefined;
          if (authInfo?.extra?.oauth) return { denied: "delegated_oauth_unavailable" as const };
          const { accountId, error } = await resolveAccountId({
            authInfo,
            accountIdOverride: undefined,
          });
          return !accountId || error
            ? { denied: "authentication_required" as const }
            : { accountId };
        },
      );
      return {
        ...getToolResultSuccess(result.body),
        ...(result.status !== 200 ? { isError: true } : {}),
      };
    },
  );
}
