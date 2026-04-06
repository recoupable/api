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
  platform: z.string().describe("Streaming platform (e.g. spotify)"),
  id: z.string().describe("Curator ID"),
});

/**
 * Registers the "research_curator" tool on the MCP server.
 * Returns a curator profile — who curates a playlist, their other playlists, and follower reach.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerResearchCuratorTool(server: McpServer): void {
  server.registerTool(
    "get_curator_info",
    {
      description:
        "Get curator profile — who curates a playlist, their other playlists, and follower reach.",
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

        const result = await proxyToChartmetric(`/curator/${args.platform}/${args.id}`);
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
          error instanceof Error ? error.message : "Failed to fetch curator",
        );
      }
    },
  );
}
