import { NextRequest, NextResponse } from "next/server";
import { validateApifyWebhookRequest } from "@/lib/apify/validateApifyWebhookRequest";
import { getApifyResultHandler } from "@/lib/apify/getApifyResultHandler";
import { updateApifyScraperRun } from "@/lib/supabase/apify_scraper_runs/updateApifyScraperRun";

/**
 * Handler for `POST /api/apify`. Always responds 200 so Apify does not
 * retry on our side of a failure — malformed payloads, unknown actors,
 * and downstream errors are logged and surfaced as a `status: "error"`
 * JSON body.
 *
 * @param request - Incoming webhook request.
 */
export async function apifyWebhookHandler(request: NextRequest): Promise<NextResponse> {
  const validated = await validateApifyWebhookRequest(request);
  if (validated instanceof NextResponse) return validated;

  const { actorId } = validated.eventData;

  const handler = getApifyResultHandler(actorId);
  if (!handler) {
    console.warn(`[WARN] apifyWebhookHandler: unhandled actorId ${actorId}`);
    return NextResponse.json(
      { status: "error", error: `Unhandled actorId: ${actorId}` },
      { status: 200 },
    );
  }

  try {
    const result = await handler(validated);

    // Scrape-run bookkeeping: record this run's completion and the posts that
    // were genuinely new, as an audit trail of what each scrape did. The
    // notification email this used to trigger was removed (chat#1955); the
    // record is kept because it is the only history of scrape activity.
    // Never fails the webhook.
    const runId = validated.resource.id;
    if (runId) {
      try {
        const newPostUrls =
          (result as { newPostUrls?: string[] } | null | undefined)?.newPostUrls ?? [];
        await updateApifyScraperRun(runId, newPostUrls);
      } catch (bookkeepingError) {
        console.error("[WARN] scrape run bookkeeping failed:", bookkeepingError);
      }
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("[ERROR] apifyWebhookHandler:", error);
    return NextResponse.json({ status: "error", error: "Internal server error" }, { status: 200 });
  }
}
