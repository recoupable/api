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

const schema = z.object({
  artist: z.string().describe("Artist name to research"),
});

/**
 * Registers the "research_albums" tool on the MCP server.
 * Returns an artist's full discography — albums, EPs, and singles with release dates.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerResearchAlbumsTool(server: McpServer): void {
  server.registerTool(
    "get_artist_discography",
    {
      description:
        "Get an artist's full cross-platform discography — albums, EPs, and singles with release dates. Accepts artist name. For Spotify-specific album data with track listings, use get_spotify_artist_albums instead.",
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

        const result = await proxyToChartmetric(`/artist/${resolved.id}/albums`);
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
          albums: Array.isArray(data) ? data : [],
        });
      } catch (error) {
        return getToolResultError(
          error instanceof Error ? error.message : "Failed to fetch albums",
        );
      }
    },
  );
}
