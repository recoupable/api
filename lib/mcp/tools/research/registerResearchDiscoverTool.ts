import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { proxyToChartmetric } from "@/lib/research/proxyToChartmetric";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import { deductCredits } from "@/lib/credits/deductCredits";

const schema = z.object({
  country: z.string().optional().describe("Two-letter country code (e.g. US, GB, DE)"),
  genre: z.number().optional().describe("Genre tag ID from research_genres"),
  sp_monthly_listeners_min: z.number().optional().describe("Minimum Spotify monthly listeners"),
  sp_monthly_listeners_max: z.number().optional().describe("Maximum Spotify monthly listeners"),
  sort: z.string().optional().describe("Sort column (e.g. sp_monthly_listeners, sp_followers)"),
  limit: z
    .number()
    .optional()
    .default(20)
    .describe("Maximum number of artists to return (default: 20)"),
});

/**
 * Registers the "research_discover" tool on the MCP server.
 * Discovers artists by criteria — country, genre, listener count, and growth rate.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerResearchDiscoverTool(server: McpServer): void {
  server.registerTool(
    "discover_artists",
    {
      description:
        "Discover artists by criteria — filter by country, genre, listener count, follower count, and growth rate.",
      inputSchema: schema,
    },
    async (args, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      const authInfo = extra.authInfo as McpAuthInfo | undefined;
      const { accountId, error } = await resolveAccountId({
        authInfo,
        accountIdOverride: undefined,
      });
      if (error) return getToolResultError(error);
      if (!accountId) return getToolResultError("Failed to resolve account ID");

      try {
        const queryParams: Record<string, string> = {};

        if (args.country) queryParams.code2 = args.country;
        if (args.genre !== undefined) queryParams.tagId = String(args.genre);
        if (args.sp_monthly_listeners_min !== undefined) {
          queryParams.sp_monthly_listeners_min = String(args.sp_monthly_listeners_min);
        }
        if (args.sp_monthly_listeners_max !== undefined) {
          queryParams.sp_monthly_listeners_max = String(args.sp_monthly_listeners_max);
        }
        if (args.sort) queryParams.sortColumn = args.sort;
        if (args.limit) queryParams.limit = String(args.limit);

        const result = await proxyToChartmetric("/artist/list/filter", queryParams);
        if (result.status !== 200) {
          return getToolResultError(`Request failed with status ${result.status}`);
        }
        try {
          await deductCredits({ accountId, creditsToDeduct: 5 });
        } catch {
          // Credit deduction failed but data was fetched — don't block
        }
        return getToolResultSuccess(result.data);
      } catch (error) {
        return getToolResultError(
          error instanceof Error ? error.message : "Failed to discover artists",
        );
      }
    },
  );
}
