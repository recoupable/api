import apifyClient from "@/lib/apify/client";
import { OUTSTANDING_ERROR } from "@/lib/apify/errors";
import { ApifyRunInfo } from "@/lib/apify/types";

/**
 * Starts a LinkedIn profile scrape via the harvestapi actor.
 * Mirrors the other `start<Platform>ProfileScraping` modules.
 *
 * @param handle - A LinkedIn vanity slug (e.g. `drew-thurlow`) or full profile URL.
 * @returns Apify run info, or null if the run failed to start.
 * @see https://apify.com/harvestapi/linkedin-profile-scraper
 */
const startLinkedinProfileScraping = async (handle: string): Promise<ApifyRunInfo | null> => {
  const cleanHandle = handle.trim().replace(/^@/, "");
  if (!cleanHandle) {
    throw new Error("Invalid LinkedIn handle");
  }

  const targetUrl = cleanHandle.startsWith("http")
    ? cleanHandle
    : `https://www.linkedin.com/in/${cleanHandle}`;

  const input = { profiles: [targetUrl] };

  try {
    const run = await apifyClient.actor("harvestapi/linkedin-profile-scraper").start(input);

    if (!run?.id || !run?.defaultDatasetId) {
      console.error("Failed to start LinkedIn profile scraping for handle:", handle);
      return null;
    }

    if (run.status === "FAILED" || run.status === "ABORTED") {
      throw new Error(OUTSTANDING_ERROR);
    }

    return { runId: run.id, datasetId: run.defaultDatasetId };
  } catch (error) {
    console.error("Error in startLinkedinProfileScraping:", error);
    throw error;
  }
};

export default startLinkedinProfileScraping;
