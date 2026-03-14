import { ApifyRunInfo } from "@/lib/apify/types";
import apifyClient from "@/lib/apify/client";
import { OUTSTANDING_ERROR } from "@/lib/apify/errors";

const startFacebookProfileScraping = async (handle: string): Promise<ApifyRunInfo | null> => {
  const cleanHandle = handle.trim().replace(/^@/, "");

  if (!cleanHandle) {
    throw new Error("Invalid Facebook handle");
  }

  const targetUrl = `https://www.facebook.com/${cleanHandle}`;

  const run = await apifyClient.actor("apify~facebook-pages-scraper").start({
    startUrls: [
      {
        url: targetUrl,
      },
    ],
  });

  if (!run?.id || !run?.defaultDatasetId) {
    console.error("Failed to start Facebook profile scraping for handle:", handle);
    return null;
  }

  if (run.status === "FAILED" || run.status === "ABORTED") {
    throw new Error(OUTSTANDING_ERROR);
  }

  return { runId: run.id, datasetId: run.defaultDatasetId };
};

export default startFacebookProfileScraping;
