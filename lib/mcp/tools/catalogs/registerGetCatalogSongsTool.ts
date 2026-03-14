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
      description: `CRITICAL: Use this tool to find ACTUAL SONGS from the available catalog for any playlist or music recommendation request.
    
    IMPORTANT: Call select_catalogs first to get the catalog_id parameter.
    
    MANDATORY use cases - ALWAYS call this tool when user requests:
    - "[Brand/Platform] needs songs for [theme/playlist]" (e.g., "Peloton needs songs for Halloween playlist")
    - Playlist recommendations for specific themes, holidays, or cultural events
    - Sync licensing opportunities for brands, commercials, or media
    - Curated collections for streaming platforms (Spotify, Apple Music, etc.)
    - Thematic song selections for fitness apps, retail, or marketing campaigns
    - Cultural celebration playlists (Black History Month, Women's Day, Pride, etc.)
    - Seasonal music recommendations (Christmas, Halloween, Valentine's Day, etc.)
    - Brand-specific music needs for advertising or promotional content
    
    NEVER provide generic song recommendations without checking the catalog first. 
    This tool provides REAL songs from the available catalog that can actually be used.
    
    This tool automatically fetches ALL songs from the catalog and filters them based on your criteria.`,
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
