import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { insertCatalogSongsFunction } from "@/lib/catalog/insertCatalogSongs";
import {
  insertCatalogSongsQuerySchema,
  type InsertCatalogSongsQuery,
} from "@/lib/catalog/validateInsertCatalogSongsQuery";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";

/**
 * Registers the "insert_catalog_songs" tool on the MCP server.
 * Add songs to a catalog by ISRC in batch.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerInsertCatalogSongsTool(server: McpServer): void {
  server.registerTool(
    "insert_catalog_songs",
    {
      description: `Add songs to a catalog by ISRC in batch.
    
    IMPORTANT: Call select_catalogs first to get available catalog_id values.
    
    Use this tool when you need to:
    - Add songs to an existing catalog
    - Bulk import songs into a catalog
    - Associate songs with a catalog using their ISRC codes
    
    Requirements: 
    - Each song requires both catalog_id and isrc
    - Songs are added in batch (multiple songs in one request)
    - catalog_id must be obtained from select_catalogs tool
    - ISRC is the International Standard Recording Code for the song`,
      inputSchema: insertCatalogSongsQuerySchema,
    },
    async (args: InsertCatalogSongsQuery) => {
      const response = await insertCatalogSongsFunction(args.songs);
      return getToolResultSuccess(response);
    },
  );
}
