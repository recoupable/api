import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

export const runValuationBodySchema = z.object({
  spotify_artist_id: z.string().min(1, "spotify_artist_id must not be empty"),
});

export type ValidatedRunValuationRequest = {
  accountId: string;
  spotify_artist_id: string;
};

/**
 * Validates `POST /api/valuation` — auth + body in one place (SRP). Resolves
 * the owning account from the request credentials (Privy bearer or x-api-key)
 * and requires a `spotify_artist_id`. Mirrors validateCreateMeasurementJobRequest.
 *
 * @param request - The incoming HTTP request.
 * @returns The validated `{ accountId, spotify_artist_id }`, or a NextResponse
 *   (401 for auth, 400 for body) to return directly.
 */
export async function validateRunValuationRequest(
  request: NextRequest,
): Promise<NextResponse | ValidatedRunValuationRequest> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const raw = await request.json().catch(() => null);
  const result = runValuationBodySchema.safeParse(raw);
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

  return {
    accountId: authResult.accountId,
    spotify_artist_id: result.data.spotify_artist_id,
  };
}
