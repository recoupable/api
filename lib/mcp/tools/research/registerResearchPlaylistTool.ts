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

const VALID_PLATFORMS = ["spotify", "applemusic", "deezer", "amazon", "youtube"];

const schema = z.object({
  platform: z
    .enum(["spotify", "applemusic", "deezer", "amazon", "youtube"])
    .describe("Streaming platform"),
  id: z.string().describe("Playlist ID or name to search for"),
});

/**
 * Registers the "research_playlist" tool on the MCP server.
 * Returns metadata for a single playlist — name, description, follower count, and curator info.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerResearchPlaylistTool(server: McpServer): void {
  server.registerTool(
    "get_playlist_info",
    {
      description:
        "Get playlist metadata — name, description, follower count, track count, and curator info.",
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
        if (!VALID_PLATFORMS.includes(args.platform)) {
          return getToolResultError(
            `Invalid platform. Must be one of: ${VALID_PLATFORMS.join(", ")}`,
          );
        }

        let numericId = args.id;

        if (!/^\d+$/.test(numericId)) {
          const searchResult = await proxyToChartmetric("/search", {
            q: numericId,
            type: "playlists",
            limit: "1",
          });
          if (searchResult.status !== 200) {
            return getToolResultError(`Request failed with status ${searchResult.status}`);
          }

          const playlists = searchResult.data as Record<string, unknown>[];
          if (!Array.isArray(playlists) || playlists.length === 0) {
            return getToolResultError(`No playlist found for "${args.id}"`);
          }

          numericId = String((playlists[0] as Record<string, unknown>).id);
        }

        const result = await proxyToChartmetric(`/playlist/${args.platform}/${numericId}`);
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
          error instanceof Error ? error.message : "Failed to fetch playlist",
        );
      }
    },
  );
}
