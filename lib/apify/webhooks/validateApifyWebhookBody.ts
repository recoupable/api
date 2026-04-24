import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { apifyWebhookSchema, type ApifyWebhookPayload } from "./apifyWebhookSchema";

/**
 * Validates the JSON body of an Apify webhook callback.
 *
 * Apify webhooks are unauthenticated by design (Apify is the trusted caller),
 * matching the legacy Express implementation.
 */
export function validateApifyWebhookBody(body: unknown): NextResponse | ApifyWebhookPayload {
  const parsed = apifyWebhookSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return NextResponse.json(
      {
        status: "error",
        missing_fields: firstError.path,
        error: firstError.message,
      },
      { status: 400, headers: getCorsHeaders() },
    );
  }
  return parsed.data;
}
