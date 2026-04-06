import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { resolveArtist } from "@/lib/research/resolveArtist";
import { proxyToChartmetric } from "@/lib/research/proxyToChartmetric";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import { deductCredits } from "@/lib/credits/deductCredits";

const CONFIG_PARAMS = ["audience", "genre", "mood", "musicality"] as const;

const schema = z.object({
  artist: z.string().describe("Artist name to research"),
  audience: z.string().optional().describe("Audience overlap weight: high, medium, or low"),
  genre: z.string().optional().describe("Genre similarity weight: high, medium, or low"),
  mood: z.string().optional().describe("Mood similarity weight: high, medium, or low"),
  musicality: z.string().optional().describe("Musicality similarity weight: high, medium, or low"),
  limit: z
    .number()
    .optional()
    .default(10)
    .describe("Maximum number of similar artists to return (default: 10)"),
});

/**
 * Registers the "research_similar" tool on the MCP server.
 * Finds similar artists using audience overlap, genre, mood, and musicality weights.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerResearchSimilarTool(server: McpServer): void {
  server.registerTool(
    "get_similar_artists",
    {
      description:
        "Find similar artists based on audience overlap, genre, mood, and musicality. " +
        "Returns career stage, momentum, and streaming numbers for each. " +
        "Use for competitive analysis and collaboration discovery.",
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
        const resolved = await resolveArtist(args.artist);

        if (resolved.error) {
          return getToolResultError(resolved.error);
        }

        const hasConfigParams = CONFIG_PARAMS.some(p => args[p] !== undefined);

        const queryParams: Record<string, string> = {};
        for (const key of CONFIG_PARAMS) {
          if (args[key]) queryParams[key] = args[key];
        }
        if (args.limit) queryParams.limit = String(args.limit);

        const path = hasConfigParams
          ? `/artist/${resolved.id}/similar-artists/by-configurations`
          : `/artist/${resolved.id}/relatedartists`;

        const result = await proxyToChartmetric(path, queryParams);
        if (result.status !== 200) {
          return getToolResultError(`Request failed with status ${result.status}`);
        }

        const data = result.data as Record<string, unknown>;
        try {
          await deductCredits({ accountId, creditsToDeduct: 5 });
        } catch {
          // Credit deduction failed but data was fetched — don't block
        }
        return getToolResultSuccess({
          artists: Array.isArray(data) ? data : data?.data || [],
          total: Array.isArray(data) ? undefined : data?.total,
        });
      } catch (error) {
        return getToolResultError(
          error instanceof Error ? error.message : "Failed to find similar artists",
        );
      }
    },
  );
}
