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

const VALID_PLATFORMS = ["spotify", "applemusic", "deezer", "amazon", "youtube"];

const schema = z.object({
  artist: z.string().describe("Artist name to research"),
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
    .default(20)
    .describe("Maximum number of playlists to return (default: 20)"),
});

/**
 * Registers the "research_playlists" tool on the MCP server.
 * Returns playlist placements for an artist — editorial, algorithmic, and indie.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerResearchPlaylistsTool(server: McpServer): void {
  server.registerTool(
    "get_artist_playlists",
    {
      description:
        "Get an artist's playlist placements — editorial, algorithmic, and indie playlists. " +
        "Shows playlist name, follower count, track name, and curator.",
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
          `/artist/${resolved.id}/${platform}/${status}/playlists`,
          queryParams,
        );
        if (result.status !== 200) {
          return getToolResultError(`Request failed with status ${result.status}`);
        }

        const data = result.data;
        try {
          await deductCredits({ accountId, creditsToDeduct: 5 });
        } catch {
          // Credit deduction failed but data was fetched — don't block
        }
        return getToolResultSuccess({
          placements: Array.isArray(data) ? data : [],
        });
      } catch (error) {
        return getToolResultError(
          error instanceof Error ? error.message : "Failed to fetch playlists",
        );
      }
    },
  );
}
