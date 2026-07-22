import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

export const runValuationBodySchema = z.object({
  spotify_artist_id: z.string().min(1, "spotify_artist_id must not be empty"),
});

export type RunValuationBody = z.infer<typeof runValuationBodySchema>;

/**
 * Validates a run-valuation request body `{ spotify_artist_id }`. The owning
 * account is never taken from the body - it is resolved from the request
 * credentials by the handler. Mirrors validateCreateCatalogBody.
 *
 * @param body - The parsed request body to validate.
 * @returns A 400 NextResponse if invalid, or the validated body.
 */
export function validateRunValuationBody(body: unknown): NextResponse | RunValuationBody {
  const result = runValuationBodySchema.safeParse(body);

  if (!result.success) {
    const firstError = result.error.issues[0];
    return NextResponse.json(
      {
        status: "error",
        missing_fields: firstError.path,
        error: firstError.message,
      },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  return result.data;
}
