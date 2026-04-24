import type { WebhookUpdateData } from "apify-client";
import apifyClient from "@/lib/apify/client";
import { OUTSTANDING_ERROR } from "@/lib/apify/errors";
import type { ApifyRunInfo } from "@/lib/apify/types";

export interface StartInstagramProfileScrapingInput {
  handles: string[];
  webhooks?: readonly WebhookUpdateData[];
}

export async function startInstagramProfileScraping({
  handles,
  webhooks,
}: StartInstagramProfileScrapingInput): Promise<ApifyRunInfo | null> {
  const cleanHandles = handles
    .map(handle => handle.trim().replace(/^@/, ""))
    .filter(handle => handle.length > 0);

  if (cleanHandles.length === 0) {
    throw new Error("Invalid Instagram handle");
  }

  const run = await apifyClient
    .actor("apify~instagram-profile-scraper")
    .start({ usernames: cleanHandles, webhooks });

  if (!run?.id || !run?.defaultDatasetId) {
    console.error("Failed to start Instagram profile scraping for handles:", handles);
    return null;
  }

  if (run.status === "FAILED" || run.status === "ABORTED") {
    throw new Error(OUTSTANDING_ERROR);
  }

  return { runId: run.id, datasetId: run.defaultDatasetId };
}
