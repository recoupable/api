import { selectScheduledPosts } from "@/lib/supabase/scheduled_posts/selectScheduledPosts";
import { findConnectedAccountId } from "@/lib/publishing/findConnectedAccountId";
import { publishToPlatform } from "@/lib/publishing/publish/publishToPlatform";
import type { PostPlatform } from "@/lib/publishing/const";
import type { PublishResult } from "@/lib/publishing/publish/types";

/**
 * Publish one post to its platform.
 *
 * Never retried (`maxRetries = 0`): a retry after a partial success, such as a
 * post created but its read-back failed, would publish the video twice. A
 * failure is recorded once and the caller decides whether to post again.
 *
 * The connection is resolved here, not at create time, so a post always uses
 * the connection as it is when publishing: the artist's when the post names
 * one, else the account's own.
 *
 * @param postId - The post id.
 * @returns The live URL and text check.
 */
export async function publishPostStep(postId: string): Promise<PublishResult> {
  "use step";
  const [post] = await selectScheduledPosts({ id: postId });
  if (!post) throw new Error(`Post ${postId} not found`);

  const owner = post.artist_account_id ?? post.account_id;
  const connectedAccountId = await findConnectedAccountId(owner, post.platform as PostPlatform);
  if (!connectedAccountId) throw new Error(`${post.platform} is not connected for this account`);

  return publishToPlatform({ target: { accountId: owner, connectedAccountId }, post });
}

publishPostStep.maxRetries = 0;
