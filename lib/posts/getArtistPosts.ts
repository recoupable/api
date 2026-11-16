import { selectPosts } from "@/lib/supabase/posts/selectPosts";

export interface GetArtistPostsParams {
  artistAccountId: string;
  page: number;
  limit: number;
}

/**
 * Reads one page of an artist's saved posts and wraps it in the
 * `{ status, posts, pagination }` envelope. Shared by
 * `GET /api/artists/{id}/posts` and the `get_artist_posts` MCP tool; access
 * and input parsing stay with the caller.
 *
 * @param params - The artist and the already-validated page and limit.
 * @returns The posts envelope, with `total_pages` of at least 1.
 */
export async function getArtistPosts({ artistAccountId, page, limit }: GetArtistPostsParams) {
  const { posts, totalCount } = await selectPosts({ artistAccountId, page, limit });
  return {
    status: "success" as const,
    posts,
    pagination: {
      total_count: totalCount,
      page,
      limit,
      total_pages: Math.ceil(totalCount / limit) || 1,
    },
  };
}
