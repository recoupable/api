import supabase from "../serverClient";
import { selectAccountSocialIds } from "../account_socials/selectAccountSocialIds";

/**
 * Fetches a page of posts, optionally scoped to a given artist account.
 *
 * Artist-scoped path uses intra-helper composition (see
 * `account_sandboxes/selectAccountSandboxes.ts` for the same pattern):
 *   1. `selectAccountSocialIds(artistAccountId)` — indexed on
 *      `account_socials.account_id`.
 *   2. A single DB-joined `posts` query with a 2-deep `!inner` embed on
 *      `social_posts.social_id`, which handles the join, dedup, and
 *      distinct count in one PostgREST round trip.
 *
 * A true single-query 3-deep `!inner` embed
 * (`posts ← social_posts → socials ← account_socials` filtered on
 * `account_id`) is syntactically valid but hits Postgres statement timeout
 * (`57014`) on live data — the planner cannot use the indexes efficiently
 * across that depth. A DB-side view or RPC in `mono/database` would be the
 * correct way to collapse this to one round trip.
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

  if (!artistAccountId) {
    const { data, error, count } = await supabase
      .from("posts")
      .select("id, post_url, updated_at", { count: "exact" })
      .order("updated_at", { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(`Failed to fetch posts: ${error.message}`);
    return { posts: data ?? [], totalCount: count ?? 0 };
  }

  const socialIds = await selectAccountSocialIds(artistAccountId);
  if (socialIds.length === 0) return { posts: [], totalCount: 0 };

  const { data, error, count } = await supabase
    .from("posts")
    .select("id, post_url, updated_at, social_posts!inner(social_id)", {
      count: "exact",
    })
    .in("social_posts.social_id", socialIds)
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
