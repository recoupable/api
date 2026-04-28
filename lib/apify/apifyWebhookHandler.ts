import { NextRequest, NextResponse } from "next/server";
import { validateApifyWebhookRequest } from "@/lib/apify/validateApifyWebhookRequest";
import { handleInstagramProfileScraperResults } from "@/lib/apify/instagram/handleInstagramProfileScraperResults";
import { handleInstagramCommentsScraper } from "@/lib/apify/instagram/handleInstagramCommentsScraper";

const INSTAGRAM_PROFILE_ACTOR_ID = "dSCLg0C3YEZ83HzYX";
const INSTAGRAM_COMMENTS_ACTOR_ID = "SbK00X0JYCPblD2wp";

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

  try {
    switch (actorId) {
      case INSTAGRAM_PROFILE_ACTOR_ID: {
        const result = await handleInstagramProfileScraperResults(validated);
        return NextResponse.json(result, { status: 200 });
      }
      case INSTAGRAM_COMMENTS_ACTOR_ID: {
        const result = await handleInstagramCommentsScraper(validated);
        return NextResponse.json(result, { status: 200 });
      }
      default:
        console.warn(`[WARN] apifyWebhookHandler: unhandled actorId ${actorId}`);
        return NextResponse.json(
          { status: "error", error: `Unhandled actorId: ${actorId}` },
          { status: 200 },
        );
    }
  } catch (error) {
    console.error("[ERROR] apifyWebhookHandler:", error);
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 200 },
    );
  }
}
