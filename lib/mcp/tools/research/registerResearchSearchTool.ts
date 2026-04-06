import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { proxyToChartmetric } from "@/lib/research/proxyToChartmetric";
import { deductCredits } from "@/lib/credits/deductCredits";

const schema = z.object({
  query: z.string().describe("Search query — artist name, track title, or keyword"),
  type: z
    .string()
    .optional()
    .describe("Result type: artists, tracks, or albums (default: artists)"),
  limit: z.string().optional().describe("Max results to return (default: 10)"),
});

/**
 * Registers the "research_search" tool on the MCP server.
 * Searches Chartmetric for artists, tracks, or albums by keyword.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerResearchSearchTool(server: McpServer): void {
  server.registerTool(
    "search_artists",
    {
      description:
        "Search for music artists, tracks, or albums by keyword. Returns matching results with profile summaries.",
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
        const result = await proxyToChartmetric("/search", {
          q: args.query,
          type: args.type || "artists",
          limit: args.limit || "10",
        });

        if (result.status !== 200) {
          return getToolResultError(`Search failed with status ${result.status}`);
        }

        try {
          await deductCredits({ accountId, creditsToDeduct: 5 });
        } catch {
          // Credit deduction failed but data was fetched — don't block
        }

        const data = result.data as { artists?: unknown[]; tracks?: unknown[]; albums?: unknown[] };
        const results = data?.artists || data?.tracks || data?.albums || [];

        return getToolResultSuccess({ results });
      } catch (error) {
        return getToolResultError(error instanceof Error ? error.message : "Search failed");
      }
    },
  );
}
