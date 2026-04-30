import { startInstagramCommentsScraping } from "@/lib/apify/instagram/startInstagramCommentsScraping";
import { getPosts } from "@/lib/supabase/posts/getPosts";
import type { ApifyInstagramProfileResult } from "@/lib/apify/types";

/**
 * Kicks off a comments-scraper run for the newly-seen posts on a
 * profile. Posts already present in `post_comments` use a
 * `resultsLimit=1` run (cheap refresh); fully-unseen posts use the
 * default `resultsLimit` to backfill.
 *
 * Only runs when the dataset contains a single profile — multi-profile
 * runs are fan lookups and should not trigger comment scraping.
 *
 * @param dataset - Raw Apify dataset for the profile scrape.
 * @param firstResult - First row of the dataset.
 */
export async function handleInstagramProfileFollowUpRuns(
  dataset: unknown[],
  firstResult: ApifyInstagramProfileResult,
): Promise<void> {
  if (dataset.length !== 1) return;
  if (!firstResult.latestPosts || firstResult.latestPosts.length === 0) return;

  const postUrls = firstResult.latestPosts.map(p => p.url).filter(Boolean);
  if (postUrls.length === 0) return;

  const posts = await getPosts({ postUrls });
  if (posts.length === 0) {
    await startInstagramCommentsScraping(postUrls);
    return;
  }

  const withComments = posts.filter(p => p.post_comments?.length).map(p => p.post_url);
  const withSet = new Set(withComments);
  const withoutComments = postUrls.filter(url => !withSet.has(url));

  if (withComments.length > 0) await startInstagramCommentsScraping(withComments, 1);
  if (withoutComments.length > 0) await startInstagramCommentsScraping(withoutComments);
}
