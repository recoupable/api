import apifyClient from "@/lib/apify/client";
import { getApifyWebhooks } from "@/lib/apify/getApifyWebhooks";
import { ApifyRunInfo } from "@/lib/apify/types";

const startTwitterProfileScraping = async (
  handle: string,
  posts?: number,
): Promise<ApifyRunInfo | null> => {
  const cleanHandle = handle.trim();

  if (!cleanHandle) {
    throw new Error("Invalid Twitter handle");
  }

  const input = {
    twitterHandles: [cleanHandle],
    sort: "Latest",
    // Timeline items include retweets/replies, which are dropped AFTER the
    // fetch (isOriginalTweet) — depth 1 would rarely surface an authored
    // post for active retweeters (chat#1855).
    maxItems: posts ?? 10,
  };

  const run = await apifyClient
    .actor("apidojo/twitter-scraper-lite")
    .start(input, { webhooks: getApifyWebhooks() });

  return {
    runId: run.id,
    datasetId: run.defaultDatasetId,
  };
};

export default startTwitterProfileScraping;
