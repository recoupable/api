import apifyClient from "@/lib/apify/client";
import { ApifyRunInfo } from "@/lib/apify/types";

const startTwitterProfileScraping = async (handle: string): Promise<ApifyRunInfo | null> => {
  const cleanHandle = handle.trim();

  if (!cleanHandle) {
    throw new Error("Invalid Twitter handle");
  }

  const input = {
    twitterHandles: [cleanHandle],
    sort: "Latest",
    maxItems: 1,
  };

  const run = await apifyClient.actor("apidojo/twitter-scraper-lite").start(input);

  return {
    runId: run.id,
    datasetId: run.defaultDatasetId,
  };
};

export default startTwitterProfileScraping;
