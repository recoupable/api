import supabase from "../serverClient";

/**
 * Project-only query (no embed join) so the helper composes with the shared
 * `selectPostsByIds` + `enrichPostsWithPlatform` pipeline used by other
 * post-returning endpoints (e.g. /api/artists/{id}/posts).
 */
export async function selectSocialPostsBySocialId({
  social_id,
  offset,
  limit,
  latestFirst,
}: {
  social_id: string;
  offset: number;
  limit: number;
  latestFirst: boolean;
}) {
  const { data, error } = await supabase
    .from("social_posts")
    .select("post_id, social_id, updated_at")
    .eq("social_id", social_id)
    .order("updated_at", { ascending: !latestFirst })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to fetch social_posts: ${error.message}`);
  }

  return data ?? [];
}
