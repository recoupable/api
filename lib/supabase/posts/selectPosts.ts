import supabase from "../serverClient";
import { selectAccountSocialIds } from "../account_socials/selectAccountSocialIds";

/**
 * Two-query approach: resolve the artist's social_ids first, then filter
 * posts via the single-level `social_posts.social_id` join. A 3-deep nested
 * `!inner` chain with PostgREST filter paths produced 500s on the preview.
 *
 * Distinct-count requires a separate head-only query because `count: "exact"`
 * over a `!inner` join counts joined-row cardinality, not unique posts.
 */
export async function selectPosts({
  artistAccountId,
  page,
  limit,
}: {
  artistAccountId?: string;
  page: number;
  limit: number;
}) {
  const offset = (page - 1) * limit;

  let socialIds: string[] | undefined;
  if (artistAccountId) {
    socialIds = await selectAccountSocialIds(artistAccountId);
    if (socialIds.length === 0) {
      return { posts: [], totalCount: 0 };
    }
  }

  let rowsQuery = supabase
    .from("posts")
    .select("id, post_url, updated_at, social_posts!inner(social_id)")
    .order("updated_at", { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);

  let countQuery = supabase
    .from("posts")
    .select("id, social_posts!inner(social_id)", { count: "exact", head: true });

  if (socialIds) {
    rowsQuery = rowsQuery.in("social_posts.social_id", socialIds);
    countQuery = countQuery.in("social_posts.social_id", socialIds);
  }

  const [rowsResult, countResult] = await Promise.all([rowsQuery, countQuery]);

  if (rowsResult.error) {
    throw new Error(`Failed to fetch posts: ${rowsResult.error.message}`);
  }
  if (countResult.error) {
    throw new Error(`Failed to count posts: ${countResult.error.message}`);
  }

  const posts = (rowsResult.data ?? []).map(({ social_posts: _embed, ...rest }) => rest);

  return {
    posts,
    totalCount: countResult.count ?? 0,
  };
}
