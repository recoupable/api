import { NextRequest, NextResponse } from "next/server";
import { validateApifyBody } from "@/lib/apify/validateApifyBody";
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
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    console.warn("[WARN] postApifyWebhookHandler: invalid JSON");
    return NextResponse.json({ message: "Invalid JSON" }, { status: 200 });
  }

  const validated = validateApifyBody(body);
  if (validated instanceof NextResponse) {
    return validated;
  }

  try {
    const result = await handleApifyWebhook(validated);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("[ERROR] postApifyWebhookHandler:", error);
    return NextResponse.json(
      { message: "Apify webhook received (handler error)" },
      { status: 200 },
    );
  }
}
