import supabase from "../serverClient";
import { selectAccountSocialIds } from "../account_socials/selectAccountSocialIds";

/**
 * Fetches a page of posts, optionally scoped to a given artist account.
 *
 * Artist-scoped path uses a single DB-side joined query via 2-deep
 * `!inner` embed: `posts` inner-joined to `social_posts` filtered by the
 * artist's `social_id`s. PostgREST returns each parent post once and
 * `count: "exact"` yields the distinct post count — no client-side dedup.
 *
 * 3-deep `!inner` filter paths (`social_posts.socials.account_socials.account_id`)
 * return 500 at runtime, so we resolve `social_id`s separately first.
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
