import supabase from "../serverClient";

type SelectPostCommentsParams = {
  postIds?: string[];
};

/**
 * Selects rows from `post_comments`. When `postIds` is provided,
 * returns only the `post_id` column for rows in that set — used as
 * a lightweight existence check for posts that already have comments.
 *
 * @param params - Optional filters.
 */
export async function selectPostComments({ postIds }: SelectPostCommentsParams = {}) {
  let query = supabase.from("post_comments").select("post_id");

  if (postIds !== undefined) {
    if (postIds.length === 0) return [];
    query = query.in("post_id", postIds);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[ERROR] selectPostComments:", error);
    throw error;
  }

  return data ?? [];
}
