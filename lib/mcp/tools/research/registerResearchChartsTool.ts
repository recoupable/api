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
  platform: z
    .string()
    .describe("Chart platform: spotify, applemusic, tiktok, youtube, itunes, shazam, etc."),
  country: z.string().optional().describe("Two-letter country code (e.g. US, GB, DE)"),
  interval: z.string().optional().describe("Time interval (e.g. daily, weekly)"),
  type: z.string().optional().describe("Chart type (varies by platform)"),
  latest: z
    .boolean()
    .optional()
    .default(true)
    .describe("Return only the latest chart (default: true)"),
});

/**
 * Registers the "research_charts" tool on the MCP server.
 * Returns global chart positions for a given platform.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerResearchChartsTool(server: McpServer): void {
  server.registerTool(
    "get_chart_positions",
    {
      description:
        "Get global chart positions for a platform — Spotify, Apple Music, TikTok, YouTube, iTunes, Shazam, etc. " +
        "NOT artist-scoped. Returns ranked entries with track/artist info.",
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
        if (!/^[a-zA-Z0-9]+$/.test(args.platform)) {
          return getToolResultError("Invalid platform: must be alphanumeric with no slashes");
        }

        const queryParams: Record<string, string> = {};

        if (args.country) queryParams.country_code = args.country;
        if (args.interval) queryParams.interval = args.interval;
        if (args.type) queryParams.type = args.type;
        queryParams.latest = String(args.latest ?? true);

        const result = await proxyToChartmetric(`/charts/${args.platform}`, queryParams);
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
          error instanceof Error ? error.message : "Failed to fetch charts",
        );
      }
    },
  );
}
