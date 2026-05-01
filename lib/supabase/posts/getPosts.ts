import supabase from "@/lib/supabase/serverClient";

type GetPostsParams = {
  postUrls?: string[];
  postIds?: string[];
};

/**
 * Fetches `posts` rows along with the `post_id` of any related
 * `post_comments`. The embedded `post_comments` array is empty when
 * the post has no comments — useful as a one-round-trip existence
 * check.
 *
 * When `postUrls` or `postIds` is provided, scopes to rows whose
 * `post_url` / `id` is in that list. Returns an empty array when an
 * explicit but empty filter list is passed.
 *
 * @param params - Optional filters.
 */
export async function getPosts({ postUrls, postIds }: GetPostsParams = {}) {
  let query = supabase.from("posts").select("*, post_comments(post_id)");

  if (postUrls !== undefined) {
    if (postUrls.length === 0) return [];
    query = query.in("post_url", postUrls);
  }

  if (postIds !== undefined) {
    if (postIds.length === 0) return [];
    query = query.in("id", postIds);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[ERROR] getPosts:", error);
    throw error;
  }

  return data ?? [];
}
