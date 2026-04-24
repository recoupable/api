import { startInstagramCommentsScraping } from "@/lib/apify/instagram/startInstagramCommentsScraping";
import { getExistingPostComments } from "@/lib/apify/instagram/getExistingPostComments";
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

  const postUrls = firstResult.latestPosts
    .map(post => (post && typeof post.url === "string" ? post.url : ""))
    .filter(Boolean);

  if (postUrls.length === 0) return;

  const { urlsWithComments, urlsWithoutComments } = await getExistingPostComments(postUrls);

  if (urlsWithComments.length > 0) {
    await startInstagramCommentsScraping(urlsWithComments, 1);
  }

  if (urlsWithoutComments.length > 0) {
    await startInstagramCommentsScraping(urlsWithoutComments);
  }
}
