import type { WebhookEventType, WebhookUpdateData } from "apify-client";
import { getReceiverBaseUrl } from "@/lib/apify/getReceiverBaseUrl";

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
