import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { getPostsQuerySchema } from "@/lib/publishing/validateGetPostsQuery";
import { POST_PLATFORMS, POST_STATUSES } from "@/lib/publishing/const";
import { getPosts } from "@/lib/publishing/getPosts";

// Plain numeric fields keep the published JSON schema typed; the REST query
// schema then applies the same defaults (limit 20, offset 0) and cap (50).
// No account_id: the account always comes from the credential.
const getPublishedPostsSchema = z.object({
  artist_account_id: z
    .string()
    .uuid()
    .optional()
    .describe("Only posts published for this artist account."),
  platform: z.enum(POST_PLATFORMS).optional().describe("Only posts on this platform."),
  status: z
    .enum(POST_STATUSES)
    .optional()
    .describe("Only posts in this status; published posts are `posted`."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .describe("Posts to return (default 20, max 50)."),
  offset: z.number().int().min(0).optional().describe("Posts to skip, for paging (default 0)."),
});

type GetPublishedPostsArgs = z.infer<typeof getPublishedPostsSchema>;

/**
 * Registers the "get_published_posts" tool, the MCP counterpart of
 * `GET /api/posts`: the account's posts that Recoup published or scheduled,
 * newest first. Each post's id feeds `get_published_post_stats`.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerGetPublishedPostsTool(server: McpServer): void {
  server.registerTool(
    "get_published_posts",
    {
      description:
        "List the posts Recoup published or scheduled for your account, newest first, with each post's id, platform, status, post_url and publish time. Pass a post's id to get_published_post_stats for its analytics. For scraped posts from an artist's social profiles, use get_artist_posts instead.",
      inputSchema: getPublishedPostsSchema,
    },
    async (
      args: GetPublishedPostsArgs,
      extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
    ) => {
      const { accountId, error } = await resolveAccountId({
        authInfo: extra.authInfo as McpAuthInfo | undefined,
        accountIdOverride: undefined,
      });
      if (error) return getToolResultError(error);
      if (!accountId) return getToolResultError("Authentication required.");

      try {
        const query = getPostsQuerySchema.parse(args);
        const posts = await getPosts({
          accountId,
          artistAccountId: query.artist_account_id,
          status: query.status,
          platform: query.platform,
          limit: query.limit,
          offset: query.offset,
        });
        return getToolResultSuccess({ status: "success", posts });
      } catch (err) {
        console.error("[get_published_posts] failed:", err);
        return getToolResultError("Failed to list published posts.");
      }
    },
  );
}
