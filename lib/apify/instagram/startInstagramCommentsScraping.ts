import apifyClient from "@/lib/apify/client";
import { ApifyRunInfo, ApifyRunLineage } from "@/lib/apify/types";
import { getApifyWebhooks } from "@/lib/apify/getApifyWebhooks";

/**
 * Starts an Apify Instagram comments scraping run for the given post URLs.
 * Registers a webhook pointing at `/api/apify` so results are processed
 * in-process by `handleInstagramCommentsScraper` on success.
 *
 * @param postUrls - Array of Instagram post URLs to fetch comments for.
 * @param resultsLimit - Optional max comments per post (default 100).
 * @param lineage - The artist lineage of the profile run that found these posts.
 * @returns ApifyRunInfo with runId + datasetId, or null on failure.
 */
export async function startInstagramCommentsScraping(
  postUrls: string[],
  resultsLimit = 100,
  lineage: ApifyRunLineage = { origin: "artist" },
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
    { webhooks: getApifyWebhooks(lineage) },
  );

  if (!run?.id || !run?.defaultDatasetId) {
    console.error("Failed to start Instagram comments scraping for urls:", urls);
    return null;
  }

  return { runId: run.id, datasetId: run.defaultDatasetId };
}
