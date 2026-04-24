import type { WebhookEventType, WebhookUpdateData } from "apify-client";
import { NEW_API_BASE_URL } from "@/lib/consts";

/**
 * Resolves the base URL Apify should POST its webhook to. Preview deploys
 * must report to themselves, not prod — otherwise preview runs pollute the
 * production DB via the shared webhook receiver.
 */
const getReceiverBaseUrl = (): string => {
  if (process.env.VERCEL_ENV === "production") {
    return NEW_API_BASE_URL;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
};

/**
 * Webhook config registered on Apify actor runs. The Apify client
 * serializes this to base64 before including it on the start request.
 * Points at this service's `POST /api/apify` webhook receiver.
 */
export function getApifyWebhooks(): WebhookUpdateData[] {
  const eventTypes: WebhookEventType[] = ["ACTOR.RUN.SUCCEEDED"];
  return [
    {
      eventTypes,
      requestUrl: `${getReceiverBaseUrl()}/api/apify`,
    },
  ];
}
