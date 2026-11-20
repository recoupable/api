import { selectScheduledPosts } from "@/lib/supabase/scheduled_posts/selectScheduledPosts";
import { toPost } from "@/lib/publishing/toPost";

export interface GetPostsParams {
  /** The account whose posts are listed. */
  accountId: string;
  /** Optional artist the posts were published for. */
  artistAccountId?: string;
  status?: string;
  platform?: string;
  limit: number;
  offset: number;
}

/**
 * The account's posts, newest first, in the public `Post` shape. Shared by
 * `GET /api/posts` and the `get_published_posts` MCP tool, which resolve and
 * authorize the account themselves.
 *
 * @param params - See {@link GetPostsParams}.
 * @returns The matching posts.
 */
export async function getPosts({
  accountId,
  artistAccountId,
  status,
  platform,
  limit,
  offset,
}: GetPostsParams) {
  const rows = await selectScheduledPosts({
    accountId,
    artistAccountId,
    status,
    platform,
    limit,
    offset,
  });
  return rows.map(toPost);
}
