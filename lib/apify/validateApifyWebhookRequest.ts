import { NextRequest } from "next/server";
import { apifyPayloadSchema, type ApifyPayload } from "@/lib/apify/apifyPayloadSchema";

export interface ApifyWebhookValidationResult {
  ok: boolean;
  data?: ApifyPayload;
  error?: string;
}

/**
 * Parses and validates a `POST /api/apify` request body against the
 * `apifyPayloadSchema`. Returns `{ ok: true, data }` on success and
 * `{ ok: false, error }` when parsing or schema validation fails. The
 * route always returns 200 regardless, matching Apify's retry posture.
 *
 * @param request - Incoming webhook request.
 */
export async function validateApifyWebhookRequest(
  request: NextRequest,
): Promise<ApifyWebhookValidationResult> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { ok: false, error: "Invalid JSON" };
  }

  const parsed = apifyPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid payload" };
  }

  return { ok: true, data: parsed.data };
}
