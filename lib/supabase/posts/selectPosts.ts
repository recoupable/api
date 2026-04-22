import supabase from "../serverClient";
import { selectAccountSocialIds } from "../account_socials/selectAccountSocialIds";

export interface SelectPostsParams {
  artistAccountId?: string;
  page: number;
  limit: number;
}

/**
 * Fetches a page of posts. When `artistAccountId` is passed, scopes to
 * posts linked via `social_posts.social_id` to that artist's socials.
 */
export async function selectPosts({ artistAccountId, page, limit }: SelectPostsParams) {
  const offset = (page - 1) * limit;

  let query = supabase
    .from("posts")
    .select("id, post_url, updated_at, social_posts!inner(social_id)", { count: "exact" });

  if (artistAccountId) {
    const socialIds = await selectAccountSocialIds(artistAccountId);
    query = query.in("social_posts.social_id", socialIds);
  }

  const { data, error, count } = await query
    .order("updated_at", { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(`Failed to fetch posts: ${error.message}`);

  const posts = (data ?? []).map(row => ({
    id: row.id,
    post_url: row.post_url,
    updated_at: row.updated_at,
  }));

  return { posts, totalCount: count ?? 0 };
}
