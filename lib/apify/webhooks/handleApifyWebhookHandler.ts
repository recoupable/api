import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateApifyWebhookBody } from "./validateApifyWebhookBody";
import { handleSocialProfileWebhook } from "./socialProfileWebhook/handleSocialProfileWebhook";

/**
 * Handler for POST /api/apify/webhooks/socials. Mirrors the legacy Express
 * webhook: fetch the dataset, parse via the actor-specific parser, upsert
 * the social profile. Always 200 on a recognised payload so Apify doesn't
 * retry on a downstream failure.
 */
export async function handleApifyWebhookHandler(request: NextRequest): Promise<NextResponse> {
  const headers = getCorsHeaders();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { status: "error", error: "Invalid JSON body" },
      { status: 400, headers },
    );
  }

  const validated = validateApifyWebhookBody(body);
  if (validated instanceof NextResponse) {
    return validated;
  }

  try {
    const result = await handleSocialProfileWebhook(validated);
    return NextResponse.json(result, { headers });
  } catch (error) {
    console.error("[ERROR] handleApifyWebhookHandler:", error);
    return NextResponse.json({ social: null }, { headers });
  }
}
