import type { WebhookEventType, WebhookUpdateData } from "apify-client";
import { getBaseUrl } from "@/lib/networking/getBaseUrl";
import type { ApifyRunLineage } from "@/lib/apify/types";

/**
 * Webhook config registered on Apify actor runs. The Apify client
 * serializes this to base64 before including it on the start request.
 * Points at this service's `POST /api/apify` webhook receiver.
 *
 * The payload template is Apify's default body plus the run's lineage
 * (`origin`, `parentRunId`), so the receiving handler learns why the run
 * was started from the webhook body itself instead of a second Apify
 * call per webhook. Apify only interpolates bare `{{var}}` tokens, hence
 * the quoted placeholders are unquoted after stringifying.
 *
 * Returns an empty list in local dev (when the resolved base URL is
 * localhost) — Apify cannot reach a developer's machine, so the run
 * still kicks off but without a useless callback URL attached.
 *
 * @param lineage - Origin of the run and, for spawned runs, the parent run id.
 */
export function getApifyWebhooks(lineage: ApifyRunLineage): WebhookUpdateData[] {
  const baseUrl = getBaseUrl();
  if (baseUrl.startsWith("http://localhost")) return [];

  const eventTypes: WebhookEventType[] = ["ACTOR.RUN.SUCCEEDED"];
  const payloadTemplate = JSON.stringify({
    userId: "{{userId}}",
    createdAt: "{{createdAt}}",
    eventType: "{{eventType}}",
    eventData: "{{eventData}}",
    resource: "{{resource}}",
    origin: lineage.origin,
    ...(lineage.parentRunId ? { parentRunId: lineage.parentRunId } : {}),
  }).replace(/"\{\{(\w+)\}\}"/g, "{{$1}}");

  return [
    {
      eventTypes,
      requestUrl: `${baseUrl}/api/apify`,
      payloadTemplate,
    },
  ];
}
