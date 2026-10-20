import supabase from "@/lib/supabase/serverClient";

/**
 * Reads the retained caption, publish date and provider media references
 * for the given post ids (recoupable/app#2132). Callers scope the ids first
 * (e.g. selectPosts filtered to an artist's socials); this reader adds no
 * scope of its own and leaves the public posts contract untouched. Rows
 * hold provider URLs only — no bytes are stored or returned.
 *
 * @param params.postIds - Post ids to read; an empty list reads nothing.
 */
export async function selectPostMedia({ postIds }: { postIds: string[] }) {
  if (postIds.length === 0) return [];

  const { data, error } = await supabase
    .from("posts")
    .select("id, caption, published_at, media, media_observed_at")
    .in("id", postIds);

  if (error) throw new Error(`Failed to fetch post media: ${error.message}`);

  return (data ?? []).map(row => ({
    id: row.id,
    caption: row.caption,
    published_at: row.published_at,
    media: row.media,
    media_observed_at: row.media_observed_at,
  }));
}
