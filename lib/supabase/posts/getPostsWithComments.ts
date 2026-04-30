import supabase from "@/lib/supabase/serverClient";

type GetPostsWithCommentsParams = {
  postUrls?: string[];
  postIds?: string[];
};

/**
 * Fetches `posts` rows along with the `post_id` of any related
 * `post_comments`. Used to check, in a single round-trip, which posts
 * already have at least one comment recorded.
 *
 * Each row's `post_comments` is empty when the post has no comments.
 *
 * @param params - Optional filters.
 */
export async function getPostsWithComments({ postUrls, postIds }: GetPostsWithCommentsParams = {}) {
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
    console.error("[ERROR] getPostsWithComments:", error);
    throw error;
  }

  return data ?? [];
}
