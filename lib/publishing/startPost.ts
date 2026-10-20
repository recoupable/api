import { start } from "workflow/api";
import { insertScheduledPost } from "@/lib/supabase/scheduled_posts/insertScheduledPost";
import { updateScheduledPost } from "@/lib/supabase/scheduled_posts/updateScheduledPost";
import { publishPostWorkflow } from "@/app/workflows/posts/publishPostWorkflow";
import { POST_CREDITS } from "@/lib/publishing/postCredits";
import type { PostPlatform } from "@/lib/publishing/const";
import type { ValidatedCreatePostBody } from "@/lib/publishing/validateCreatePostBody";
import type { Tables } from "@/types/database.types";

/**
 * Create the post row and hand it to the publish workflow: `scheduled` when
 * it has a `publish_at`, otherwise `publishing` right away.
 *
 * The insert comes first and is the claim, as in startMusicGeneration. The
 * price is passed to the workflow as a durable argument, so the price checked
 * here is the price charged.
 *
 * @param validated - Validated body plus the resolved account.
 * @returns The inserted row.
 */
export async function startPost(
  validated: ValidatedCreatePostBody,
): Promise<Tables<"scheduled_posts">> {
  const row = await insertScheduledPost({
    account_id: validated.accountId,
    artist_account_id: validated.artist_account_id ?? null,
    platform: validated.platform,
    sub_account_id: validated.sub_account_id ?? null,
    video_url: validated.video_url,
    cover_url: validated.cover_url ?? null,
    title: validated.title ?? null,
    description: validated.description ?? null,
    privacy: validated.privacy ?? null,
    tags: validated.tags ?? null,
    publish_at: validated.publish_at ?? null,
    status: validated.publish_at ? "scheduled" : "publishing",
  });

  const run = await start(publishPostWorkflow, [
    row.id,
    {
      accountId: validated.accountId,
      platform: validated.platform as PostPlatform,
      creditsToCharge: POST_CREDITS,
      ...(validated.publish_at ? { publishAt: validated.publish_at } : {}),
    },
  ]);

  // Best effort, as in startMusicGeneration: a post that is already
  // publishing must not be failed by a bookkeeping write. A scheduled post
  // without its run id can still be cancelled: the run wakes, its claim step
  // finds the post no longer scheduled, and it exits.
  return updateScheduledPost(row.id, { workflow_run_id: run.runId }).catch(() => row);
}
