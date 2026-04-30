import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

/**
 * Schema for `POST /api/apify` webhook payloads. Only validates the
 * fields we branch on + read downstream (`actorId` for dispatch,
 * `defaultDatasetId` for fetch). Extra keys are stripped so upstream
 * schema drift does not drop events.
 */
export const apifyWebhookPayloadSchema = z.object({
  eventData: z.object({
    actorId: z.string().min(1, "eventData.actorId is required"),
  }),
  resource: z.object({
    defaultDatasetId: z.string().min(1, "resource.defaultDatasetId is required"),
  }),
});

export type ApifyWebhookPayload = z.infer<typeof apifyWebhookPayloadSchema>;

/**
 * Parses and validates a POST /api/apify webhook request.
 *
 * Returns a NextResponse on failure (malformed JSON or schema
 * mismatch) or the validated payload on success. The route's contract
 * with Apify is to always reply 2xx so Apify does not retry, so the
 * failure NextResponse uses status 200 with the project-standard
 * error body shape.
 *
 * @param request - Incoming webhook request.
 * @returns A NextResponse with an error if validation fails, or the
 *   validated payload if validation passes.
 */
export async function validateApifyWebhookRequest(
  request: NextRequest,
): Promise<NextResponse | ApifyWebhookPayload> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { status: "error", error: "Invalid JSON" },
      { status: 200, headers: getCorsHeaders() },
    );
  }

  const result = apifyWebhookPayloadSchema.safeParse(body);
  if (!result.success) {
    const firstError = result.error.issues[0];
    return NextResponse.json(
      {
        status: "error",
        missing_fields: firstError.path,
        error: firstError.message,
      },
      { status: 200, headers: getCorsHeaders() },
    );
  }

  return result.data;
}
