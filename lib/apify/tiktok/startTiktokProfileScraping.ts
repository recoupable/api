import apifyClient from "@/lib/apify/client";
import { OUTSTANDING_ERROR } from "@/lib/apify/errors";
import { ApifyRunInfo } from "@/lib/apify/types";

const startTiktokProfileScraping = async (
  handle: string,
  resultsPerPage = 1,
): Promise<ApifyRunInfo | null> => {
  const cleanHandle = handle.trim();

  if (!cleanHandle) {
    throw new Error("Invalid TikTok handle");
  }

  const input = {
    resultsPerPage,
    proxyCountryCode: "None",
    profiles: [cleanHandle],
  };

  try {
    const run = await apifyClient.actor("clockworks~tiktok-scraper").start(input);

    if (!run?.id || !run?.defaultDatasetId) {
      console.error("Failed to start TikTok profile scraping for handle:", handle);
      return null;
    }

    if (run.status === "FAILED" || run.status === "ABORTED") {
      throw new Error(OUTSTANDING_ERROR);
    }

    return {
      runId: run.id,
      datasetId: run.defaultDatasetId,
    };
  } catch (error) {
    console.error("Error in startProfileScraping:", error);
    throw error;
  }
};

export default startTiktokProfileScraping;
