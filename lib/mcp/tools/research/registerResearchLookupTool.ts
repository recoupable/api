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
  url: z.string().describe("Spotify URL or platform ID"),
});

/**
 * Registers the "research_lookup" tool on the MCP server.
 * Looks up an artist by a Spotify URL or platform ID and returns the artist profile.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerResearchLookupTool(server: McpServer): void {
  server.registerTool(
    "lookup_artist_by_url",
    {
      description: "Look up an artist by a Spotify URL or platform ID. Returns the artist profile.",
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
        const spotifyId = args.url.split("/").pop()?.split("?")[0];

        if (!spotifyId) {
          return getToolResultError("Could not extract Spotify ID from URL");
        }

        const result = await proxyToChartmetric(`/artist/spotify/${spotifyId}/get-ids`);
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
          error instanceof Error ? error.message : "Failed to look up artist",
        );
      }
    },
  );
}
