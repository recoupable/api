import { NextRequest, NextResponse } from "next/server";
import { validateApifyWebhookRequest } from "@/lib/apify/validateApifyWebhookRequest";
import { handleApifyWebhook } from "@/lib/apify/handleApifyWebhook";

/**
 * Handler for `POST /api/apify`. Always responds 200 so Apify does not
 * retry on our side of a failure — malformed payloads and downstream
 * errors are logged and surfaced in the response body.
 *
 * @param request - Incoming webhook request.
 * @returns JSON response (always status 200).
 */
export async function postApifyWebhookHandler(request: NextRequest): Promise<NextResponse> {
  const validation = await validateApifyWebhookRequest(request);

  if (!validation.ok || !validation.data) {
    console.warn("[WARN] postApifyWebhookHandler: invalid payload:", validation.error);
    return NextResponse.json(
      { message: "Invalid payload", error: validation.error },
      { status: 200 },
    );
  }

  try {
    const result = await handleApifyWebhook(validation.data);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("[ERROR] postApifyWebhookHandler:", error);
    return NextResponse.json(
      { message: "Apify webhook received (handler error)" },
      { status: 200 },
    );
  }
}
