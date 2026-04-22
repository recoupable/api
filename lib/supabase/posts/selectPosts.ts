import supabase from "../serverClient";
import { selectAccountSocialIds } from "../account_socials/selectAccountSocialIds";

export interface SelectPostsParams {
  socialId?: string;
  artistAccountId?: string;
  page: number;
  limit: number;
  latestFirst?: boolean;
}

/**
 * Fetches a page of posts. When `socialId` is passed, scopes to posts linked
 * to that single social. When `artistAccountId` is passed (and `socialId` is
 * not), scopes to posts linked via `social_posts.social_id` to any of that
 * artist's socials. `latestFirst` controls ordering on `updated_at`.
 */
export async function selectPosts({
  socialId,
  artistAccountId,
  page,
  limit,
  latestFirst = true,
}: SelectPostsParams) {
  const offset = (page - 1) * limit;

  let query = supabase
    .from("posts")
    .select("id, post_url, updated_at, social_posts!inner(social_id)", { count: "exact" });

  if (socialId) {
    query = query.eq("social_posts.social_id", socialId);
  } else if (artistAccountId) {
    const socialIds = await selectAccountSocialIds(artistAccountId);
    query = query.in("social_posts.social_id", socialIds);
  }

  const { data, error, count } = await query
    .order("updated_at", { ascending: !latestFirst, nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(`Failed to fetch posts: ${error.message}`);

  const posts = (data ?? []).map(row => ({
    id: row.id,
    post_url: row.post_url,
    updated_at: row.updated_at,
  }));

  return { posts, totalCount: count ?? 0 };
}
