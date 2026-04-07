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

const VALID_PLATFORMS = ["spotify", "applemusic", "deezer", "amazon"];

const schema = z.object({
  id: z
    .string()
    .optional()
    .describe("Chartmetric track ID. Provide this or q."),
  q: z
    .string()
    .optional()
    .describe("Track name to search for. Provide this or id."),
  platform: z
    .string()
    .optional()
    .default("spotify")
    .describe("Streaming platform (default: spotify)"),
  status: z
    .string()
    .optional()
    .default("current")
    .describe("Playlist status: current or past (default: current)"),
  editorial: z.boolean().optional().describe("Filter to editorial playlists only"),
  limit: z
    .number()
    .optional()
    .default(10)
    .describe("Maximum number of playlists to return (default: 10)"),
});

/**
 * Registers the "get_track_playlists" tool on the MCP server.
 * Returns playlist placements for a specific track.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerResearchTrackPlaylistsTool(server: McpServer): void {
  server.registerTool(
    "get_track_playlists",
    {
      description:
        "Get playlists featuring a specific track. " +
        "Use this to find which editorial, indie, and algorithmic playlists a particular song is on. " +
        "Returns playlist name, cover image, follower count, and curator.",
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

      if (!args.id && !args.q) {
        return getToolResultError("Either id or q parameter is required");
      }

      try {
        let trackId = args.id;

        if (!trackId) {
          const searchResult = await proxyToChartmetric("/search", {
            q: args.q!,
            type: "tracks",
            limit: "1",
          });

          if (searchResult.status !== 200) {
            return getToolResultError(`Track search failed with status ${searchResult.status}`);
          }

          const tracks = (searchResult.data as { tracks?: Array<{ id: number }> })?.tracks;
          if (!tracks || tracks.length === 0) {
            return getToolResultError(`No track found matching "${args.q}"`);
          }

          trackId = String(tracks[0].id);
        }

        const platform = args.platform ?? "spotify";
        if (!VALID_PLATFORMS.includes(platform)) {
          return getToolResultError(
            `Invalid platform. Must be one of: ${VALID_PLATFORMS.join(", ")}`,
          );
        }
        const status = args.status ?? "current";

        const queryParams: Record<string, string> = {};
        if (args.limit) queryParams.limit = String(args.limit);

        if (args.editorial !== undefined) {
          queryParams.editorial = String(args.editorial);
        } else {
          queryParams.editorial = "true";
          queryParams.indie = "true";
          queryParams.majorCurator = "true";
          queryParams.popularIndie = "true";
        }

        const result = await proxyToChartmetric(
          `/track/${trackId}/${platform}/${status}/playlists`,
          queryParams,
        );

        if (result.status !== 200) {
          return getToolResultError(`Request failed with status ${result.status}`);
        }

        try {
          await deductCredits({ accountId, creditsToDeduct: 5 });
        } catch {
          // Credit deduction failed but data was fetched — don't block
        }

        return getToolResultSuccess({
          placements: Array.isArray(result.data) ? result.data : [],
        });
      } catch (err) {
        return getToolResultError(
          err instanceof Error ? err.message : "Failed to fetch track playlists",
        );
      }
    },
  );
}
