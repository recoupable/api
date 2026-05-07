import apifyClient from "@/lib/apify/client";
import { ApifyRunInfo } from "@/lib/apify/types";
import { getApifyWebhooks } from "@/lib/apify/getApifyWebhooks";

/**
 * Starts an Apify Instagram comments scraping run for the given post URLs.
 * Registers a webhook pointing at `/api/apify` so results are processed
 * in-process by `handleInstagramCommentsScraper` on success.
 *
 * @param postUrls - Array of Instagram post URLs to fetch comments for.
 * @param resultsLimit - Optional max comments per post (default 100).
 * @returns ApifyRunInfo with runId + datasetId, or null on failure.
 */
export async function startInstagramCommentsScraping(
  postUrls: string[],
  resultsLimit = 100,
): Promise<ApifyRunInfo | null> {
  const urls = (postUrls ?? []).filter(Boolean);

  if (urls.length === 0) {
    throw new Error("At least one Instagram post URL is required");
  }

  const run = await apifyClient.actor("SbK00X0JYCPblD2wp").start(
    {
      directUrls: urls,
      resultsLimit,
    },
    { webhooks: getApifyWebhooks() },
  );

  if (!run?.id || !run?.defaultDatasetId) {
    console.error("Failed to start Instagram comments scraping for urls:", urls);
    return null;
  }

  return { runId: run.id, datasetId: run.defaultDatasetId };
}
