import { startInstagramCommentsScraping } from "@/lib/apify/instagram/startInstagramCommentsScraping";
import { registerSpawnedApifyRun } from "@/lib/apify/registerSpawnedApifyRun";
import { guardApifyRunBudget } from "@/lib/apify/guardApifyRunBudget";
import { getPosts } from "@/lib/supabase/posts/getPosts";
import type { ApifyInstagramProfileResult, ApifyRunLineage } from "@/lib/apify/types";

/**
 * Kicks off comments-scraper runs for an artist profile's latest posts.
 * Posts already present in `post_comments` use a `resultsLimit=1` run
 * (cheap refresh); fully-unseen posts use the default `resultsLimit` to
 * backfill. Each spawned run carries the artist lineage and is registered
 * under the profile run that found the posts.
 *
 * The caller decides whether follow-ups are allowed at all (artist origin
 * + account link, app#2018); this function only fans out.
 *
 * @param profile - The artist's profile item.
 * @param lineage - Artist lineage; `parentRunId` is the profile run.
 */
export async function handleInstagramProfileFollowUpRuns(
  profile: ApifyInstagramProfileResult,
  lineage: ApifyRunLineage,
): Promise<void> {
  const postUrls = Array.from(
    new Set((profile.latestPosts ?? []).flatMap(p => (p.url ? [p.url] : []))),
  );
  if (postUrls.length === 0) return;
  if (lineage.parentRunId) {
    const verdict = await guardApifyRunBudget({
      parentRunId: lineage.parentRunId,
      platform: "instagram",
    });
    if (!verdict.allowed) return;
  }

  const start = async (urls: string[], resultsLimit?: number) => {
    const run = await startInstagramCommentsScraping(urls, resultsLimit, lineage);
    if (run && lineage.parentRunId) {
      await registerSpawnedApifyRun({
        runId: run.runId,
        parentRunId: lineage.parentRunId,
        origin: lineage.origin,
        platform: "instagram",
      });
    }
  };

  const posts = await getPosts({ postUrls });
  const withComments = posts.filter(p => p.post_comments?.length).map(p => p.post_url);
  const withSet = new Set(withComments);
  const withoutComments = postUrls.filter(url => !withSet.has(url));

  if (withComments.length > 0) await start(withComments, 1);
  if (withoutComments.length > 0) await start(withoutComments);
}
