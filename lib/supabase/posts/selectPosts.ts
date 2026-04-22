import supabase from "../serverClient";

/**
 * Fetches a page of posts, optionally scoped to a given artist account.
 *
 * Single PostgREST round trip via nested inner-joined embeds:
 *   posts ← social_posts!inner → socials!inner → account_socials!inner
 *
 * PostgREST returns parent `posts` rows once with their matching children
 * nested underneath, so `count: "exact"` correctly counts distinct posts and
 * no client-side dedup is needed. The embedded children are stripped before
 * returning.
 *
 * A companion DB view (`public.artist_posts`) will reduce this to a flat
 * single-table query once the `create_artist_posts_view` migration
 * (`mono/database` submodule) deploys — tracked separately.
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

  const { data, error, count } = await supabase
    .from("posts")
    .select(
      "id, post_url, updated_at, social_posts!inner(socials!inner(account_socials!inner(account_id)))",
      { count: "exact" },
    )
    .eq("social_posts.socials.account_socials.account_id", artistAccountId)
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
