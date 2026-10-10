import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { catalogPlaycountHistoryQuerySchema } from "@/lib/catalog/validateCatalogPlaycountHistoryQuery";
import { getCatalogPlaycountHistory } from "@/lib/catalog/getCatalogPlaycountHistory";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";

/** Register the shared store-backed catalog comparison read on authenticated standard MCP. */
export function registerGetCatalogPlaycountHistoryTool(server: McpServer): void {
  server.registerTool(
    "get_catalog_playcount_history",
    {
      description:
        "Read saved public Spotify cumulative playcount observations for an accessible catalog, including unmeasured songs. Compare equal periods using since (current UTC observation-period start) and days (1–31). These are changes between observations, not exact daily streams, royalty statements or evidence of marketing causation. Page through every recording while pagination.has_more is true; increment page by one. Summaries apply only to the returned page and current membership. No collection, provider calls or charges. Incomplete days, timing drift and corrections suppress growth. Source update time and individual provider identity are unavailable in this legacy series.",
      inputSchema: catalogPlaycountHistoryQuerySchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async (args, extra) => {
      const authInfo = extra.authInfo as McpAuthInfo | undefined;
      // Full delegated connections require a separate organization-grant audit.
      if (authInfo?.extra?.oauth)
        return { ...getToolResultError("Unavailable for delegated OAuth"), isError: true };
      const { accountId, error } = await resolveAccountId({
        authInfo,
        accountIdOverride: undefined,
      });
      if (error || !accountId)
        return { ...getToolResultError("Authentication required"), isError: true };
      try {
        const parsed = catalogPlaycountHistoryQuerySchema.safeParse(args);
        if (!parsed.success)
          return { ...getToolResultError("Invalid comparison query"), isError: true };
        const result = await getCatalogPlaycountHistory(accountId, parsed.data);
        return "error" in result
          ? { ...getToolResultError(result.error), isError: true }
          : getToolResultSuccess(result.data);
      } catch {
        return { ...getToolResultError("Catalog playcount history unavailable"), isError: true };
      }
    },
  );
}
