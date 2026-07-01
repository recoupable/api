import { NextRequest, NextResponse } from "next/server";
import { validateApifyWebhookRequest } from "@/lib/apify/validateApifyWebhookRequest";
import { getApifyResultHandler } from "@/lib/apify/getApifyResultHandler";

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
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("[ERROR] apifyWebhookHandler:", error);
    return NextResponse.json({ status: "error", error: "Internal server error" }, { status: 200 });
  }
}
