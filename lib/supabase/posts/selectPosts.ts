import supabase from "../serverClient";

/**
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

  let rowsQuery = supabase
    .from("posts")
    .select(
      "*, social_posts!inner(social:socials!inner(profile_url, account_socials!inner(account_id)))",
    )
    .order("updated_at", { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);

  let countQuery = supabase
    .from("posts")
    .select("id, social_posts!inner(social:socials!inner(account_socials!inner(account_id)))", {
      count: "exact",
      head: true,
    });

  if (artistAccountId) {
    rowsQuery = rowsQuery.eq("social_posts.social.account_socials.account_id", artistAccountId);
    countQuery = countQuery.eq("social_posts.social.account_socials.account_id", artistAccountId);
  }

  const [rowsResult, countResult] = await Promise.all([rowsQuery, countQuery]);

  if (rowsResult.error) {
    throw new Error(`Failed to fetch posts: ${rowsResult.error.message}`);
  }
  if (countResult.error) {
    throw new Error(`Failed to count posts: ${countResult.error.message}`);
  }

  return {
    posts: rowsResult.data ?? [],
    totalCount: countResult.count ?? 0,
  };
}
