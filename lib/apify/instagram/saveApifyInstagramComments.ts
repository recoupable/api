import { upsertPostComments } from "@/lib/supabase/post_comments/upsertPostComments";
import { getOrCreatePostsForComments } from "@/lib/apify/instagram/getOrCreatePostsForComments";
import { getOrCreateSocialsForComments } from "@/lib/apify/instagram/getOrCreateSocialsForComments";
import type { TablesInsert } from "@/types/database.types";
import type { ApifyInstagramComment } from "@/lib/apify/types";

/**
 * Persists Apify Instagram comment dataset items into `post_comments`,
 * first ensuring that a matching `posts` and `socials` row exists for
 * each comment. Comments referencing missing posts/socials are skipped
 * with a warning. Errors propagate up to the webhook route.
 *
 * @param comments - Apify dataset items.
 */
export async function saveApifyInstagramComments(comments: ApifyInstagramComment[]) {
  if (comments.length === 0) return;

  const postUrls = Array.from(new Set(comments.map(c => c.postUrl).filter(Boolean)));
  const postsMap = await getOrCreatePostsForComments(postUrls);
  const socialsMap = await getOrCreateSocialsForComments(comments);

  const rows: TablesInsert<"post_comments">[] = [];

  for (const comment of comments) {
    if (!comment.postUrl || !comment.ownerUsername || !comment.timestamp) continue;

    const post = postsMap.get(comment.postUrl);
    const social = socialsMap.get(comment.ownerUsername);

    if (!post || !social) {
      console.warn(
        `[WARN] saveApifyInstagramComments: missing post/social for comment ${comment.id}`,
      );
      continue;
    }

    rows.push({
      post_id: post.id,
      social_id: social.id,
      comment: comment.text,
      commented_at: comment.timestamp,
    });
  }

  if (rows.length > 0) {
    await upsertPostComments(rows);
  }
}
