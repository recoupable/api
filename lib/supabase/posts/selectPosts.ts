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

  const socialIds = artistAccountId ? await selectAccountSocialIds(artistAccountId) : undefined;
  if (socialIds && socialIds.length === 0) return { posts: [], totalCount: 0 };

  const base = supabase.from("posts");
  const query = socialIds
    ? base
        .select("id, post_url, updated_at, social_posts!inner(social_id)", { count: "exact" })
        .in("social_posts.social_id", socialIds)
    : base.select("id, post_url, updated_at", { count: "exact" });

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
