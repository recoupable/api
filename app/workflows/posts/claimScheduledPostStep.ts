import { updateScheduledPostIfStatus } from "@/lib/supabase/scheduled_posts/updateScheduledPostIfStatus";

/**
 * Claim a scheduled post for publishing when its time comes.
 *
 * The status flip is the claim: a post cancelled while the run slept is no
 * longer `scheduled`, so nothing is claimed and nothing is sent.
 *
 * @param postId - The post id.
 * @returns Whether the post was still scheduled and is now publishing.
 */
export async function claimScheduledPostStep(postId: string): Promise<boolean> {
  "use step";
  const row = await updateScheduledPostIfStatus(postId, "scheduled", { status: "publishing" });
  return row !== null;
}
