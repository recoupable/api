import apifyClient from "@/lib/apify/client";
import { OUTSTANDING_ERROR } from "@/lib/apify/errors";
import { ApifyRunInfo } from "@/lib/apify/types";
import { getApifyWebhooks } from "@/lib/apify/getApifyWebhooks";

/**
 * Starts an Apify Instagram profile scraping run for one or more handles.
 * Registers a `webhooks` payload pointing at this service's
 * `/api/apify` receiver so follow-up processing runs in-process.
 *
 * @param handles - A single handle or array of handles to scrape.
 * @returns ApifyRunInfo with runId + datasetId, or null on failure.
 */
export async function startInstagramProfileScraping(
  handles: string | string[],
): Promise<ApifyRunInfo | null> {
  const list = Array.isArray(handles) ? handles : [handles];
  const cleanHandles = list.map(h => h.trim().replace(/^@/, "")).filter(h => h.length > 0);

  if (cleanHandles.length === 0) {
    throw new Error("Invalid Instagram handle");
  }

  const run = await apifyClient
    .actor("apify~instagram-profile-scraper")
    .start({ usernames: cleanHandles }, { webhooks: getApifyWebhooks() });

  if (!run?.id || !run?.defaultDatasetId) {
    console.error("Failed to start Instagram profile scraping for handles:", cleanHandles);
    return null;
  }

  if (run.status === "FAILED" || run.status === "ABORTED") {
    throw new Error(OUTSTANDING_ERROR);
  }

  return { runId: run.id, datasetId: run.defaultDatasetId };
}
