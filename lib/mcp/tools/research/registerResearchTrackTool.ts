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
  q: z.string().describe("Track name or Spotify URL"),
});

/**
 * Registers the "research_track" tool on the MCP server.
 * Searches for a track by name or URL and returns its metadata.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerResearchTrackTool(server: McpServer): void {
  server.registerTool(
    "get_track_info",
    {
      description: "Get track metadata — title, artist, album, release date, and popularity.",
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
        const searchResult = await proxyToChartmetric("/search", {
          q: args.q,
          type: "tracks",
          limit: "1",
        });
        if (searchResult.status !== 200) {
          return getToolResultError(`Request failed with status ${searchResult.status}`);
        }

        const searchData = searchResult.data as { tracks?: Array<{ id: number }> };
        const tracks = searchData?.tracks;
        if (!Array.isArray(tracks) || tracks.length === 0) {
          return getToolResultError(`No track found for "${args.q}"`);
        }

        const trackId = tracks[0].id;
        const result = await proxyToChartmetric(`/track/${trackId}`);
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
        return getToolResultError(error instanceof Error ? error.message : "Failed to fetch track");
      }
    },
  );
}
