import type { WebhookUpdateData } from "apify-client";
import { getBaseUrl } from "@/lib/networking/getBaseUrl";

/**
 * Returns the Apify `webhooks` start option that points runs at this api
 * deployment's social-webhook receiver. Uses the deployment-specific URL
 * so preview runs report back to their own preview, not prod.
 */
export function getSocialsWebhookConfig(): WebhookUpdateData[] {
  return [
    {
      eventTypes: ["ACTOR.RUN.SUCCEEDED"],
      requestUrl: `${getBaseUrl()}/api/apify/webhooks/socials`,
    },
  ];
}
