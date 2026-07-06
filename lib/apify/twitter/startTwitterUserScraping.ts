import apifyClient from "@/lib/apify/client";
import { getApifyWebhooks } from "@/lib/apify/getApifyWebhooks";
import { ApifyRunInfo } from "@/lib/apify/types";

/**
 * Starts a profile-level X/Twitter scrape via `apidojo/twitter-user-scraper`
 * (resolved actor id `V38PZzpEgOfeeWvZY`). Used as the fallback when the
 * tweet-based `apidojo/twitter-scraper-lite` run returns zero items — a
 * tweetless account never surfaces its `author` profile stats on tweet items,
 * so its connected social row would otherwise never update (chat#1851).
 *
 * Results are persisted by `handleTwitterUserScraperResults` via the shared
 * Apify webhook receiver.
 */
const startTwitterUserScraping = async (handle: string): Promise<ApifyRunInfo | null> => {
  const cleanHandle = handle.trim();

  if (!cleanHandle) {
    throw new Error("Invalid Twitter handle");
  }

  const input = {
    twitterHandles: [cleanHandle],
    maxItems: 1,
  };

  const run = await apifyClient
    .actor("apidojo/twitter-user-scraper")
    .start(input, { webhooks: getApifyWebhooks() });

  return {
    runId: run.id,
    datasetId: run.defaultDatasetId,
  };
};

export default startTwitterUserScraping;
