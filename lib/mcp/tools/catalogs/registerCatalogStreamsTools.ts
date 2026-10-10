import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { catalogPlaycountHistoryQuerySchema } from "@/lib/catalog/validateCatalogPlaycountHistoryQuery";
import { catalogStreamTrackingSchema } from "@/lib/catalog/validateCatalogStreamTracking";
import { getCatalogStreams } from "@/lib/catalog/getCatalogStreams";
import { manageCatalogStreamTracking } from "@/lib/catalog/manageCatalogStreamTracking";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";

/** Register source-reported daily streams and explicit catalog collection controls. */
export function registerCatalogStreamsTools(server: McpServer): void {
  server.registerTool(
    "get_catalog_streams",
    {
      description:
        "Read saved Luminate worldwide daily stream totals across reporting DSPs for an accessible catalog. Not Spotify-only. Compare complete equal periods with since (current period start) and days (1–31); page until has_more is false. Missing dates and recording identity changes suppress growth. Includes latest collection attempt/coverage and retrieval timestamps. No provider requests. Summaries are page-scoped and current-membership only.",
      inputSchema: catalogPlaycountHistoryQuerySchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async (input, extra) => {
      const authInfo = extra.authInfo as McpAuthInfo | undefined;
      if (authInfo?.extra?.oauth)
        return { ...getToolResultError("Unavailable for delegated OAuth"), isError: true };
      const { accountId, error } = await resolveAccountId({
        authInfo,
        accountIdOverride: undefined,
      });
      if (error || !accountId)
        return { ...getToolResultError("Authentication required"), isError: true };
      try {
        const result = await getCatalogStreams(accountId, input);
        return "error" in result
          ? { ...getToolResultError(result.error), isError: true }
          : getToolResultSuccess(result.data);
      } catch {
        return { ...getToolResultError("Catalog streams unavailable"), isError: true };
      }
    },
  );
  server.registerTool(
    "manage_catalog_stream_tracking",
    {
      description:
        "Enable, disable, refresh or inspect daily Luminate stream tracking for an accessible catalog. Enable starts a 62-day backfill and daily refreshes; newly added recordings are included on the next run. Disable stops collection and retains history. Refresh requests at most one run per UTC day and subscription revision. Worldwide aggregate across reporting DSPs, not DSP-specific totals. MVP maximum 250 recordings per catalog. Enable and refresh make provider requests asynchronously.",
      inputSchema: catalogStreamTrackingSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    async (input, extra) => {
      const authInfo = extra.authInfo as McpAuthInfo | undefined;
      if (authInfo?.extra?.oauth)
        return { ...getToolResultError("Unavailable for delegated OAuth"), isError: true };
      const { accountId, error } = await resolveAccountId({
        authInfo,
        accountIdOverride: undefined,
      });
      if (error || !accountId)
        return { ...getToolResultError("Authentication required"), isError: true };
      try {
        const result = await manageCatalogStreamTracking(accountId, input);
        return "error" in result
          ? { ...getToolResultError(result.error), isError: true }
          : getToolResultSuccess(result.data);
      } catch {
        return { ...getToolResultError("Catalog stream tracking unavailable"), isError: true };
      }
    },
  );
}
