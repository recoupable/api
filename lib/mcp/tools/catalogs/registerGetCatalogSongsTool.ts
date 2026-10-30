import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { analyzeFullCatalog } from "@/lib/catalog/analyzeFullCatalog";
import {
  getCatalogSongsQuerySchema,
  type GetCatalogSongsQuery,
} from "@/lib/catalog/validateGetCatalogSongsQuery";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";

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
      description: `Find catalog candidates matching your criteria through AI batch analysis. Get catalog_id from select_catalogs.

For a nonempty catalog, sends ISRCs, song names, artist names, and your criteria to an AI provider in batches of up to 100 songs per model call. All batches are analyzed before the 1,000-match output cap; results preserve catalog order, not relevance rank. Empty catalogs return without model analysis.

Read-only does not mean free. Repeated calls can repeat provider work and cost; billing idempotency is not established. Charges, approval requirements, spending ceilings, and retry handling remain unmeasured or unapproved for this operation. This description does not authorize spending or use of a song.

Catalog presence does not establish licensing clearance or permission for a proposed use.`,
      inputSchema: getCatalogSongsQuerySchema,
    },
    async (args: GetCatalogSongsQuery) => {
      const response = await analyzeFullCatalog({
        catalogId: args.catalog_id,
        criteria: args.criteria,
      });

      return getToolResultSuccess(response);
    },
  );
}
