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
    maxItems: posts ?? 1,
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
