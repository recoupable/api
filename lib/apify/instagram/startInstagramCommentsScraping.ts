import type { WebhookUpdateData } from "apify-client";
import apifyClient from "@/lib/apify/client";
import { OUTSTANDING_ERROR } from "@/lib/apify/errors";
import type { ApifyRunInfo } from "@/lib/apify/types";

export interface StartInstagramCommentsScrapingInput {
  postUrls: string[];
  resultsLimit?: number;
  isNewestComments?: boolean;
  webhooks?: readonly WebhookUpdateData[];
}

// Actor id per chat/lib/apify/handleApifyWebhook.ts (SbK00X0JYCPblD2wp = Instagram Comments Scraper)
const INSTAGRAM_COMMENTS_ACTOR_ID = "SbK00X0JYCPblD2wp";

export async function startInstagramCommentsScraping({
  postUrls,
  resultsLimit,
  isNewestComments,
  webhooks,
}: StartInstagramCommentsScrapingInput): Promise<ApifyRunInfo | null> {
  const cleanUrls = postUrls.map(u => u.trim()).filter(u => u.length > 0);

  if (cleanUrls.length === 0) {
    throw new Error("Invalid Instagram post URLs");
  }

  const input: Record<string, unknown> = {
    directUrls: cleanUrls,
    resultsLimit: resultsLimit ?? 10000,
  };
  if (isNewestComments !== undefined) {
    input.isNewestComments = isNewestComments;
  }

  const run = await apifyClient.actor(INSTAGRAM_COMMENTS_ACTOR_ID).start(input, { webhooks });

  if (!run?.id || !run?.defaultDatasetId) {
    console.error("Failed to start Instagram comments scraping for urls:", postUrls);
    return null;
  }

  if (run.status === "FAILED" || run.status === "ABORTED") {
    throw new Error(OUTSTANDING_ERROR);
  }

  return { runId: run.id, datasetId: run.defaultDatasetId };
}
