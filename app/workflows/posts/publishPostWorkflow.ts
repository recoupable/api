import { publishPostStep } from "@/app/workflows/posts/publishPostStep";
import { markPostStep } from "@/app/workflows/posts/markPostStep";

/**
 * Durable social post (recoupable/app#2241): publish the row's video and copy
 * through the account's own connection, then record the live URL and whether
 * the live text matches what was submitted.
 *
 * Publish-now only; scheduling adds a `sleep(publish_at)` in front of the same
 * steps in a follow-up.
 *
 * @param postId - The scheduled_posts row id.
 */
export async function publishPostWorkflow(postId: string) {
  "use workflow";

  let result: Awaited<ReturnType<typeof publishPostStep>>;
  try {
    result = await publishPostStep(postId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[publish-post] Failed for ${postId}:`, message);
    // Best effort: if the row is unreachable there is nothing left to mark.
    await markPostStep(postId, { status: "failed", error_message: message }).catch(() => {});
    return { success: false as const, error: message };
  }

  // Outside the try: the post is live, so a bookkeeping failure must never
  // mark it `failed`. markPostStep keeps its default retries.
  await markPostStep(postId, {
    status: "posted",
    post_url: result.postUrl,
    text_verified: result.textVerified,
  });

  return { success: true as const, postId, postUrl: result.postUrl };
}
