import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  getCatalogsQuerySchema,
  type GetCatalogsQuery,
} from "@/lib/catalog/validateGetCatalogsQuery";
import { selectAccountCatalogs } from "@/lib/supabase/account_catalogs/selectAccountCatalogs";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
/**
 * Registers the "select_catalogs" tool on the MCP server.
 * Retrieves catalogs associated with the current account for ANY music recommendation request.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerGetCatalogsTool(server: McpServer): void {
  server.registerTool(
    "select_catalogs",
    {
      description: `Get catalogs for an account.
    
        MANDATORY: Call this tool FIRST when you receive a request for:
        - "[Brand/Platform] needs songs for [theme/playlist]" 
        - Any playlist recommendations
        - Music suggestions for specific themes, holidays, or events
        - Sync licensing opportunities
        - Curated collections for platforms
        
        Returns music catalog metadata including id, name, created_at, and updated_at.`,
      inputSchema: getCatalogsQuerySchema,
    },
    async (args: GetCatalogsQuery) => {
      const data = await selectAccountCatalogs({ accountIds: [args.account_id] });
      return getToolResultSuccess(data);
    },
  );
}
