import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { getCatalogOwnerIds } from "@/lib/catalog/getCatalogOwnerIds";
import { selectAccountCatalogs } from "@/lib/supabase/account_catalogs/selectAccountCatalogs";
import { analyzeFullCatalog } from "@/lib/catalog/analyzeFullCatalog";
import { getCatalogSongsQuerySchema } from "@/lib/catalog/validateGetCatalogSongsQuery";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";

const catalogSearchSchema = getCatalogSongsQuerySchema.extend({
  criteria: getCatalogSongsQuerySchema.shape.criteria.max(2000),
  start_page: z
    .number()
    .int()
    .positive()
    .max(10_000_000)
    .optional()
    .describe(
      "Start at page 1 or use nextPage returned by the previous search. Each page covers up to 100 tracks.",
    ),
});

/**
 * Registers the "select_catalog_songs" tool on the MCP server.
 * Use this tool to find ACTUAL SONGS from the available catalog for any playlist or music recommendation request.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerGetCatalogSongsTool(server: McpServer): void {
  server.registerTool(
    "select_catalog_songs",
    {
      title: "Find Matching Catalog Tracks",
      description:
        "Find tracks that match a brief in a catalog your connected Recoup account can access. Recoup sends track titles, artist names, ISRCs, and your brief to an AI provider and analyzes up to 1,000 tracks per call without deducting Recoup credits. Results follow catalog order. Use nextPage to continue a larger catalog. A match does not establish licensing clearance.",
      inputSchema: catalogSearchSchema,
    },
    async (args, extra) => {
      const { accountId, error } = await resolveAccountId({
        authInfo: extra.authInfo as McpAuthInfo | undefined,
        accountIdOverride: undefined,
      });
      if (!accountId) return getToolResultError(error ?? "Authentication required.");
      try {
        const catalogs = await selectAccountCatalogs(await getCatalogOwnerIds(accountId), {
          catalogIds: [args.catalog_id],
        });
        if (!catalogs.some(catalog => catalog.id === args.catalog_id)) {
          return getToolResultError("Catalog access denied.");
        }
        return getToolResultSuccess(
          await analyzeFullCatalog({
            catalogId: args.catalog_id,
            criteria: args.criteria,
            startPage: args.start_page ?? 1,
          }),
        );
      } catch (error) {
        console.error("[select_catalog_songs] failed:", error);
        return getToolResultError("Could not search the catalog.");
      }
    },
  );
}
