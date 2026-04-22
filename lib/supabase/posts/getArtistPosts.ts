import supabase from "../serverClient";

/**
 * Pushes the posts → social_posts → socials → account_socials join into a
 * single PostgREST query so we make one round trip instead of four, and so
 * ordering/pagination stay stable against the `posts` base (unique by id —
 * no in-memory dedup needed). Profile url rides along on the embed for
 * downstream platform derivation.
 *
 * `count: "exact"` against a `!inner` join can over-count by joined-row
 * cardinality rather than distinct posts, so we issue a separate
 * head-only count with the same filter to get a distinct-posts total.
 */
export async function getArtistPosts({
  artistAccountId,
  page,
  limit,
}: {
  artistAccountId: string;
  page: number;
  limit: number;
}) {
  const offset = (page - 1) * limit;

  const [rowsResult, countResult] = await Promise.all([
    supabase
      .from("posts")
      .select(
        `*, social_posts!inner(social:socials!inner(profile_url, account_socials!inner(account_id)))`,
      )
      .eq("social_posts.social.account_socials.account_id", artistAccountId)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1),
    supabase
      .from("posts")
      .select(`id, social_posts!inner(social:socials!inner(account_socials!inner(account_id)))`, {
        count: "exact",
        head: true,
      })
      .eq("social_posts.social.account_socials.account_id", artistAccountId),
  ]);

  if (rowsResult.error) {
    throw new Error(`Failed to fetch artist posts: ${rowsResult.error.message}`);
  }
  if (countResult.error) {
    throw new Error(`Failed to count artist posts: ${countResult.error.message}`);
  }

  return {
    posts: rowsResult.data ?? [],
    totalCount: countResult.count ?? 0,
  };
}
