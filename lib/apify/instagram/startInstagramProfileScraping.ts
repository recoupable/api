import apifyClient from "@/lib/apify/client";
import { OUTSTANDING_ERROR } from "@/lib/apify/errors";
import { ApifyRunInfo } from "@/lib/apify/types";

const startInstagramProfileScraping = async (handle: string): Promise<ApifyRunInfo | null> => {
  const cleanHandle = handle.trim().replace(/^@/, "");

  if (!cleanHandle) {
    throw new Error("Invalid Instagram handle");
  }

  try {
    const run = await apifyClient.actor("apify~instagram-profile-scraper").start({
      usernames: [cleanHandle],
    });

    if (!run?.id || !run?.defaultDatasetId) {
      console.error("Failed to start Instagram profile scraping for handle:", handle);
      return null;
    }

    if (run.status === "FAILED" || run.status === "ABORTED") {
      throw new Error(OUTSTANDING_ERROR);
    }

    return { runId: run.id, datasetId: run.defaultDatasetId };
  } catch (error) {
    console.error("Error in startProfileScraping:", error);
    return null;
  }
};

export default startInstagramProfileScraping;
