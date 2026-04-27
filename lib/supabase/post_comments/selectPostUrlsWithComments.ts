import { getPosts } from "@/lib/supabase/posts/getPosts";
import { selectPostComments } from "./selectPostComments";

/**
 * Returns the subset of `postUrls` for which at least one row exists in
 * `post_comments`. Used by the Apify follow-up dispatcher to decide
 * whether a post needs a full comments backfill or just a cheap refresh.
 *
 * Composes `getPosts` (URL → id) and `selectPostComments` (post_id
 * existence) so each underlying supabase call stays single-table.
 */
export async function selectPostUrlsWithComments(postUrls: string[]) {
  if (postUrls.length === 0) return [];

  const posts = await getPosts({ postUrls });
  if (posts.length === 0) return [];

  const postIds = posts.map(p => p.id);
  const comments = await selectPostComments({ postIds });

  const postIdsWithComments = new Set(comments.map(c => c.post_id));
  return posts.filter(p => postIdsWithComments.has(p.id)).map(p => p.post_url);
}
