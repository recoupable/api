import type { WebhookEventType, WebhookUpdateData } from "apify-client";
import { getBaseUrl } from "@/lib/networking/getBaseUrl";

/**
 * Webhook config registered on Apify actor runs. The Apify client
 * serializes this to base64 before including it on the start request.
 * Points at this service's `POST /api/apify` webhook receiver.
 *
 * Returns an empty list in local dev (when the resolved base URL is
 * localhost) — Apify cannot reach a developer's machine, so the run
 * still kicks off but without a useless callback URL attached.
 */
export function getApifyWebhooks(): WebhookUpdateData[] {
  const baseUrl = getBaseUrl();
  if (baseUrl.startsWith("http://localhost")) return [];

  const eventTypes: WebhookEventType[] = ["ACTOR.RUN.SUCCEEDED"];
  return [
    {
      eventTypes,
      requestUrl: `${baseUrl}/api/apify`,
    },
  ];
}
