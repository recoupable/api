import apifyClient from "@/lib/apify/client";
import { upsertPostComments } from "@/lib/supabase/post_comments/upsertPostComments";
import { getOrCreatePostsForComments } from "@/lib/apify/instagram/getOrCreatePostsForComments";
import { getOrCreateSocialsForComments } from "@/lib/apify/instagram/getOrCreateSocialsForComments";
import { startInstagramProfileScraping } from "@/lib/apify/instagram/startInstagramProfileScraping";
import { registerSpawnedApifyRun } from "@/lib/apify/registerSpawnedApifyRun";
import { guardApifyRunBudget } from "@/lib/apify/guardApifyRunBudget";
import type { ApifyWebhookPayload } from "@/lib/apify/validateApifyWebhookRequest";
import type { ApifyInstagramComment } from "@/lib/apify/types";
import type { TablesInsert } from "@/types/database.types";

/**
 * Handles Instagram comments scraper Apify webhook results:
 *  - Persists comments into `post_comments` (auto-creating any missing
 *    `posts` and commenter `socials` rows first).
 *  - Kicks off ONE fan-profile scrape for the distinct commenter
 *    usernames so their socials get enriched (best-effort: failures
 *    are logged but don't fail the comments ingestion). That run is
 *    started with `origin: "fan"`, which makes it terminal — the
 *    profile handler enriches every fan and schedules nothing
 *    (app#2018).
 *
 * Errors from the dataset fetch or comment persistence propagate up
 * to the webhook route, which logs and returns an error response.
 *
 * @param parsed - Validated Apify webhook payload.
 */
export async function handleInstagramCommentsScraper(parsed: ApifyWebhookPayload) {
  const { items } = await apifyClient.dataset(parsed.resource.defaultDatasetId).listItems();
  const comments = items as unknown as ApifyInstagramComment[];
  const processedPostUrls = Array.from(new Set(comments.map(c => c.postUrl).filter(Boolean)));

  if (comments.length > 0) {
    const postsMap = await getOrCreatePostsForComments(comments.map(c => c.postUrl));
    const socialsMap = await getOrCreateSocialsForComments(comments);

    const rows: TablesInsert<"post_comments">[] = [];
    for (const c of comments) {
      if (!c.postUrl || !c.ownerUsername || !c.timestamp) continue;
      const post = postsMap.get(c.postUrl);
      const social = socialsMap.get(c.ownerUsername);
      if (!post || !social) {
        console.warn(`[WARN] missing post/social for comment ${c.id}`);
        continue;
      }
      rows.push({
        post_id: post.id,
        social_id: social.id,
        comment: c.text,
        commented_at: c.timestamp,
      });
    }
    if (rows.length > 0) await upsertPostComments(rows);
  }

  const fanHandles = Array.from(new Set(comments.map(c => c.ownerUsername).filter(Boolean)));
  if (fanHandles.length > 0) {
    try {
      const parentRunId = parsed.resource.id;
      if (parentRunId) {
        const verdict = await guardApifyRunBudget({ parentRunId, platform: "instagram" });
        if (!verdict.allowed) return { comments, processedPostUrls };
      }
      const run = await startInstagramProfileScraping(fanHandles, { origin: "fan", parentRunId });
      if (run && parentRunId) {
        await registerSpawnedApifyRun({
          runId: run.runId,
          parentRunId,
          origin: "fan",
          platform: "instagram",
        });
      }
    } catch (error) {
      console.error("[ERROR] fan profile scrape failed:", error);
    }
  }

  return { comments, processedPostUrls };
}
