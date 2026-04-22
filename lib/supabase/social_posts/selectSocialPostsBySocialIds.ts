import supabase from "../serverClient";

const SOCIAL_ID_CHUNK_SIZE = 100;
const PAGE_SIZE = 1000;

/**
 * Paginated fetch is required because Supabase/PostgREST caps any single
 * response to 1000 rows; an artist with many posts would otherwise be
 * silently truncated. Chunking social_ids at 100 per `.in()` call keeps
 * URL length under PostgREST's parse limit when this is called with many
 * socials.
 */
export async function selectSocialPostsBySocialIds(
  socialIds: string[],
): Promise<Array<{ post_id: string; social_id: string }>> {
  if (!socialIds.length) return [];

  const rows: Array<{ post_id: string; social_id: string }> = [];

  for (let i = 0; i < socialIds.length; i += SOCIAL_ID_CHUNK_SIZE) {
    const chunk = socialIds.slice(i, i + SOCIAL_ID_CHUNK_SIZE);
    let page = 0;

    while (true) {
      const { data, error } = await supabase
        .from("social_posts")
        .select("post_id, social_id")
        .in("social_id", chunk)
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (error) {
        throw new Error(`Failed to fetch social_posts: ${error.message}`);
      }

      if (!data || data.length === 0) break;

      for (const row of data) {
        if (row.post_id && row.social_id) {
          rows.push({ post_id: row.post_id, social_id: row.social_id });
        }
      }

      if (data.length < PAGE_SIZE) break;
      page++;
    }
  }

  return rows;
}
