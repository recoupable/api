import supabase from "@/lib/supabase/serverClient";

type GetPostsParams = {
  postUrls?: string[];
  postIds?: string[];
};

/**
 * Fetches `posts` rows. When `postUrls` is provided, scopes to rows
 * whose `post_url` is in that list. When `postIds` is provided, scopes
 * to rows whose `id` is in that list. Returns an empty array when an
 * explicit but empty filter list is passed.
 *
 * @param params - Optional filters.
 */
export async function getPosts({ postUrls, postIds }: GetPostsParams = {}) {
  let query = supabase.from("posts").select("*");

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
