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
 * Registers the "research_milestones" tool on the MCP server.
 * Returns an artist's activity feed — playlist adds, chart entries, and notable events.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerResearchMilestonesTool(server: McpServer): void {
  server.registerTool(
    "get_artist_milestones",
    {
      description:
        "Get an artist's activity feed — playlist adds, chart entries, and notable events. " +
        "Each milestone includes a date, summary, platform, track name, and star rating.",
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

        const result = await proxyToChartmetric(`/artist/${resolved.id}/milestones`);
        if (result.status !== 200) {
          return getToolResultError(`Request failed with status ${result.status}`);
        }
        const milestones = (result.data as Record<string, unknown>)?.insights || [];
        try {
          await deductCredits({ accountId, creditsToDeduct: 5 });
        } catch {
          // Credit deduction failed but data was fetched — don't block
        }
        return getToolResultSuccess({ milestones });
      } catch (error) {
        return getToolResultError(
          error instanceof Error ? error.message : "Failed to fetch milestones",
        );
      }
    },
  );
}
