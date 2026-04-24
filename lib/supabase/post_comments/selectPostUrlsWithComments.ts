import supabase from "../serverClient";

/**
 * Returns the subset of `postUrls` for which at least one row exists in
 * `post_comments`. Used by the Apify follow-up dispatcher to decide
 * whether a post needs a full comments backfill or just a cheap refresh.
 *
 * Implemented as a narrow two-step lookup (post ids, then a distinct
 * `post_id` scan on `post_comments`) so we don't pull whole comment
 * rows with joins just to answer an existence question.
 */
export async function selectPostUrlsWithComments(postUrls: string[]): Promise<string[]> {
  if (postUrls.length === 0) return [];

  const { data: posts, error: postsErr } = await supabase
    .from("posts")
    .select("id, post_url")
    .in("post_url", postUrls);

  if (postsErr) {
    console.error("[ERROR] selectPostUrlsWithComments (posts):", postsErr);
    throw postsErr;
  }

  if (!posts || posts.length === 0) return [];

  const postIds = posts.map(p => p.id);
  const { data: comments, error: commentsErr } = await supabase
    .from("post_comments")
    .select("post_id")
    .in("post_id", postIds);

  if (commentsErr) {
    console.error("[ERROR] selectPostUrlsWithComments (post_comments):", commentsErr);
    throw commentsErr;
  }

  const postIdsWithComments = new Set((comments ?? []).map(c => c.post_id));
  return posts.filter(p => postIdsWithComments.has(p.id)).map(p => p.post_url);
}
