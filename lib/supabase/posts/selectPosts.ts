import supabase from "../serverClient";

/**
 * Fetches a page of posts, optionally scoped to a given artist account.
 *
 * Artist-scoped path is a single PostgREST round trip using 3-deep nested
 * `!inner` embeds with explicit FK hints:
 *   posts ← social_posts (post_id) → socials (social_id) ← account_socials (social_id)
 *
 * FK names come from `types/database.types.ts` and are required so PostgREST
 * resolves each edge deterministically; without hints we saw runtime 500s.
 * Parent rows are deduped by PostgREST, so `count: "exact"` yields the
 * distinct post count and no client-side dedup or extra round trips are needed.
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
      "id, post_url, updated_at, social_posts!social_posts_post_id_fkey!inner(socials!social_posts_social_id_fkey!inner(account_socials!account_socials_social_id_fkey!inner(account_id)))",
      { count: "exact" },
    )
    .eq("social_posts.socials.account_socials.account_id", artistAccountId)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(
      `Failed to fetch posts: ${error.message} | code=${error.code ?? "n/a"} | hint=${error.hint ?? "n/a"} | details=${error.details ?? "n/a"}`,
    );
  }

  const posts = (data ?? []).map(row => ({
    id: row.id,
    post_url: row.post_url,
    updated_at: row.updated_at,
  }));

  return { posts, totalCount: count ?? 0 };
}
