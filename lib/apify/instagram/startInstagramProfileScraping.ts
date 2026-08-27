import apifyClient from "@/lib/apify/client";
import { ApifyRunInfo, ApifyRunLineage } from "@/lib/apify/types";
import { getApifyWebhooks } from "@/lib/apify/getApifyWebhooks";

/**
 * Starts an Apify Instagram profile scraping run for one or more handles.
 * Registers a `webhooks` payload pointing at this service's
 * `/api/apify` receiver so follow-up processing runs in-process.
 *
 * @param handles - A single handle or array of handles to scrape.
 * @param lineage - Why the run starts (`artist` profile vs `fan` batch) and
 *   the parent run; stamped into the webhook payload (app#2018).
 * @returns ApifyRunInfo with runId + datasetId, or null on failure.
 */
export async function startInstagramProfileScraping(
  handles: string | string[],
  lineage: ApifyRunLineage,
): Promise<ApifyRunInfo | null> {
  const list = Array.isArray(handles) ? handles : [handles];
  const cleanHandles = Array.from(
    new Set(list.map(h => h.trim().replace(/^@/, "").toLowerCase()).filter(h => h.length > 0)),
  );

  if (cleanHandles.length === 0) {
    throw new Error("Invalid Instagram handle");
  }

  const run = await apifyClient
    .actor("apify~instagram-profile-scraper")
    .start({ usernames: cleanHandles }, { webhooks: getApifyWebhooks(lineage) });

  if (!run?.id || !run?.defaultDatasetId) {
    console.error("Failed to start Instagram profile scraping for handles:", cleanHandles);
    return null;
  }

  return { runId: run.id, datasetId: run.defaultDatasetId };
}
