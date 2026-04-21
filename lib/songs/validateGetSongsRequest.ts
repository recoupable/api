import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validationErrorResponse } from "@/lib/zod/validationErrorResponse";

export const getSongsParamsSchema = z.object({
  isrc: z.string().trim().min(1, "isrc cannot be empty").optional(),
  artist_account_id: z.string().uuid("artist_account_id must be a valid UUID").optional(),
});

export type GetSongsParams = z.infer<typeof getSongsParamsSchema>;

/**
 * Auth-only; no `checkAccountArtistAccess` — song metadata is DSP-public
 * (same data DSPs expose via ISRC lookup), so per-artist scoping would not
 * meaningfully reduce exposure.
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
