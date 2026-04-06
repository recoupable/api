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
  platform: z
    .enum(["instagram", "tiktok", "youtube"])
    .optional()
    .default("instagram")
    .describe("Platform for audience data (default: instagram)"),
});

/**
 * Registers the "research_audience" tool on the MCP server.
 * Returns audience demographics — age, gender, and country breakdown.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerResearchAudienceTool(server: McpServer): void {
  server.registerTool(
    "get_artist_audience",
    {
      description:
        "Get audience demographics for an artist — age, gender, and country breakdown. " +
        "Defaults to Instagram. Also supports tiktok and youtube.",
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

        const platform = args.platform ?? "instagram";
        const result = await proxyToChartmetric(
          `/artist/${resolved.id}/${platform}-audience-stats`,
        );
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
          error instanceof Error ? error.message : "Failed to fetch audience data",
        );
      }
    },
  );
}
