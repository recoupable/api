import { ApifyRunInfo, ApifyRunLineage } from "@/lib/apify/types";
import apifyClient from "@/lib/apify/client";
import { getApifyWebhooks } from "@/lib/apify/getApifyWebhooks";
import { OUTSTANDING_ERROR } from "@/lib/apify/errors";

const startThreadsProfileScraping = async (
  handle: string,
  _posts?: number,
  lineage: ApifyRunLineage = { origin: "artist" },
): Promise<ApifyRunInfo | null> => {
  const cleanHandle = handle.trim().replace(/^@/, "");

  if (!cleanHandle) {
    throw new Error("Invalid Threads handle");
  }

  const run = await apifyClient.actor("apify~threads-profile-api-scraper").start(
    {
      usernames: [cleanHandle],
    },
    { webhooks: getApifyWebhooks(lineage) },
  );

  if (!run?.id || !run?.defaultDatasetId) {
    console.error("Failed to start Threads profile scraping for handle:", handle);
    return null;
  }

  if (run.status === "FAILED" || run.status === "ABORTED") {
    throw new Error(OUTSTANDING_ERROR);
  }

  return {
    runId: run.id,
    datasetId: run.defaultDatasetId,
  };
};

export default startThreadsProfileScraping;
