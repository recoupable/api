import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { getPostStats } from "@/lib/publishing/stats/getPostStats";

const getPublishedPostStatsSchema = z.object({
  id: z.string().uuid().describe("The post id, from get_published_posts."),
});

type GetPublishedPostStatsArgs = z.infer<typeof getPublishedPostStatsSchema>;

/**
 * Registers the "get_published_post_stats" tool, the MCP counterpart of
 * `GET /api/posts/{id}/stats`: a published post's platform analytics, read
 * live. Each successful read costs $0.001.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerGetPublishedPostStatsTool(server: McpServer): void {
  server.registerTool(
    "get_published_post_stats",
    {
      description:
        "Read a published post's live analytics (impressions, unique impressions, clicks, likes, comments, shares, engagement, and video views, viewers and watch time) for a post id from get_published_posts. Only published LinkedIn company-page posts have stats. Each successful read costs $0.001, so keep the result rather than polling.",
      inputSchema: getPublishedPostStatsSchema,
    },
    async (
      args: GetPublishedPostStatsArgs,
      extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
    ) => {
      const { accountId, error } = await resolveAccountId({
        authInfo: extra.authInfo as McpAuthInfo | undefined,
        accountIdOverride: undefined,
      });
      if (error) return getToolResultError(error);
      if (!accountId) return getToolResultError("Authentication required.");

      try {
        const result = await getPostStats({ accountId, postId: args.id });
        if (result.kind === "rejected") return getToolResultError(result.message);
        if (result.kind === "insufficient_credits") {
          return getToolResultError(
            `Insufficient credits: ${result.remainingCredits} remaining, ${result.requiredCredits} required`,
          );
        }
        return getToolResultSuccess({ status: "success", stats: result.stats });
      } catch (err) {
        console.error("[get_published_post_stats] failed:", err);
        return getToolResultError("Failed to read post stats.");
      }
    },
  );
}
