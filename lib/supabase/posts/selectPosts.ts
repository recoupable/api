import supabase from "../serverClient";
import { selectAccountSocialIds } from "../account_socials/selectAccountSocialIds";

const SOCIAL_ID_CHUNK_SIZE = 100;

/**
 * Artist-filtered path resolves social_ids → distinct post_ids via
 * `social_posts`, then fetches the paginated slice from `posts` by id.
 * Embedded-filter joins (`social_posts.social_id in (...)`) returned empty
 * or 500 on the preview; this flat approach is empirically reliable.
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

  const postIds = await selectDistinctPostIdsForSocials(socialIds);
  if (postIds.length === 0) return { posts: [], totalCount: 0 };

  const pageIds = postIds.slice(offset, offset + limit);
  if (pageIds.length === 0) return { posts: [], totalCount: postIds.length };

  const { data, error } = await supabase
    .from("posts")
    .select("id, post_url, updated_at")
    .in("id", pageIds)
    .order("updated_at", { ascending: false, nullsFirst: false });

  if (error) throw new Error(`Failed to fetch posts: ${error.message}`);

  return { posts: data ?? [], totalCount: postIds.length };
}

/**
 * Returns distinct post_ids for the given socials, ordered by social_posts
 * `updated_at desc` so pagination slice reflects recency.
 */
async function selectDistinctPostIdsForSocials(socialIds: string[]): Promise<string[]> {
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (let i = 0; i < socialIds.length; i += SOCIAL_ID_CHUNK_SIZE) {
    const chunk = socialIds.slice(i, i + SOCIAL_ID_CHUNK_SIZE);
    const { data, error } = await supabase
      .from("social_posts")
      .select("post_id, updated_at")
      .in("social_id", chunk)
      .order("updated_at", { ascending: false, nullsFirst: false });

    if (error) throw new Error(`Failed to fetch social_posts: ${error.message}`);

    for (const row of data ?? []) {
      if (row.post_id && !seen.has(row.post_id)) {
        seen.add(row.post_id);
        ordered.push(row.post_id);
      }
    }
  }

  return ordered;
}
