import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { resolveArtist } from "@/lib/research/resolveArtist";
import { proxyToChartmetric } from "@/lib/research/proxyToChartmetric";
import { deductCredits } from "@/lib/credits/deductCredits";

const schema = z.object({
  artist: z.string().describe("Artist name to research"),
});

/**
 * Registers the "research_artist" tool on the MCP server.
 * Looks up a music artist by name and returns their full Chartmetric profile.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerResearchArtistTool(server: McpServer): void {
  server.registerTool(
    "get_artist_profile",
    {
      description:
        "Search for a music artist and get their full profile — bio, genres, social URLs, label, and career stage. Pass an artist name.",
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

        const result = await proxyToChartmetric(`/artist/${resolved.id}`);
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
          error instanceof Error ? error.message : "Failed to research artist",
        );
      }
    },
  );
}
