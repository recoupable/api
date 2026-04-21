import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validationErrorResponse } from "@/lib/zod/validationErrorResponse";

/**
 * Zod schema for GET /api/songs query parameters.
 *
 * Both filters are optional; an unfiltered request returns the full song list
 * ordered by `updated_at` DESC to preserve parity with the legacy Express
 * `/songs` route.
 */
export const getSongsParamsSchema = z.object({
  isrc: z.string().trim().min(1, "isrc cannot be empty").optional(),
  artist_account_id: z.string().uuid("artist_account_id must be a valid UUID").optional(),
});

export type GetSongsParams = z.infer<typeof getSongsParamsSchema>;

/**
 * Validates GET /api/songs: authenticates the caller and parses query filters.
 *
 * Auth policy: plain `validateAuthContext` only — no `checkAccountArtistAccess`
 * for `artist_account_id`. Song metadata (title, artist, ISRC, release) is
 * effectively DSP-public (the same data Spotify/Apple/YouTube expose publicly
 * via ISRC lookup), so per-artist song lists are unions of the same
 * DSP-public data. Scoping them would not meaningfully reduce exposure.
 * Authentication alone is the correct gate here; do not add a scope check
 * for this endpoint.
 *
 * @param request - The incoming request (carries `x-api-key` or `Authorization` header).
 * @returns `NextResponse` on auth/validation failure, otherwise the parsed
 *   snake_case params ready to be passed directly into `getSongsWithArtists`.
 */
export async function validateGetSongsRequest(
  request: NextRequest,
): Promise<NextResponse | GetSongsParams> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { searchParams } = new URL(request.url);
  const rawParams: Record<string, string> = {};
  const isrc = searchParams.get("isrc");
  const artistAccountId = searchParams.get("artist_account_id");
  if (isrc !== null) rawParams.isrc = isrc;
  if (artistAccountId !== null) rawParams.artist_account_id = artistAccountId;

  const { data, error } = getSongsParamsSchema.safeParse(rawParams);

  if (error) {
    const firstError = error.issues[0];
    return validationErrorResponse(firstError.message, firstError.path);
  }

  return data;
}
