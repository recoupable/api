import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { getArtistPostsParamsSchema } from "@/lib/posts/validateGetArtistPostsRequest";
import { checkAccountArtistAccess } from "@/lib/artists/checkAccountArtistAccess";
import { getArtistPosts } from "@/lib/posts/getArtistPosts";

// Plain numeric fields keep the published JSON schema typed; the REST query
// schema then applies the same defaults (page 1, limit 20) and cap (100).
const getArtistPostsSchema = z.object({
  artist_account_id: z.string().uuid().describe("The artist account ID whose posts to list."),
  page: z.number().int().positive().optional().describe("Page number, starting at 1."),
  limit: z
    .number()
    .int()
    .positive()
    .max(100)
    .optional()
    .describe("Posts per page (default 20, max 100)."),
});

type GetArtistPostsArgs = z.infer<typeof getArtistPostsSchema>;

/**
 * Registers the "get_artist_posts" tool, the MCP counterpart of
 * `GET /api/artists/{id}/posts`: saved posts across the artist's linked
 * socials, newest first, with engagement counts.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerGetArtistPostsTool(server: McpServer): void {
  server.registerTool(
    "get_artist_posts",
    {
      title: "List Saved Artist Social Posts",
      description:
        "List saved public post URLs and engagement counts for an artist your connected Recoup account can access. Results are ordered by most recently updated and read from previously collected data.",
      inputSchema: getArtistPostsSchema,
    },
    async (
      args: GetArtistPostsArgs,
      extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
    ) => {
      const { accountId, error } = await resolveAccountId({
        authInfo: extra.authInfo as McpAuthInfo | undefined,
        accountIdOverride: undefined,
      });
      if (error) return getToolResultError(error);
      if (!accountId) return getToolResultError("Authentication required.");

      try {
        const params = getArtistPostsParamsSchema.parse(args);
        if (!(await checkAccountArtistAccess(accountId, params.artist_account_id))) {
          return getToolResultError("Access denied to specified artist_account_id");
        }

        return getToolResultSuccess(
          await getArtistPosts({
            artistAccountId: params.artist_account_id,
            page: params.page,
            limit: params.limit,
          }),
        );
      } catch (err) {
        console.error("[get_artist_posts] failed:", err);
        return getToolResultError("Failed to list artist posts.");
      }
    },
  );
}
