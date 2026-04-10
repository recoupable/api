import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { checkAccountArtistAccess } from "@/lib/artists/checkAccountArtistAccess";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { selectAccounts } from "@/lib/supabase/accounts/selectAccounts";

export const pinArtistBodySchema = z.object({
  artistId: z.uuid({ message: "artistId must be a valid UUID" }),
  pinned: z.boolean({ message: "pinned must be a boolean" }),
});

export interface ValidatedPinArtistRequest {
  artistId: string;
  pinned: boolean;
  requesterAccountId: string;
}

/**
 * Validates POST /api/artists/pin body and authentication.
 *
 * @param request - The incoming request
 * @returns The validated pin request or a NextResponse error
 */
export async function validatePinArtistBody(
  request: NextRequest,
): Promise<ValidatedPinArtistRequest | NextResponse> {
  const body = await safeParseJson(request);
  const result = pinArtistBodySchema.safeParse(body);
  if (!result.success) {
    const firstError = result.error.issues[0];

    return NextResponse.json(
      {
        status: "error",
        missing_fields: firstError.path,
        error: firstError.message,
      },
      {
        status: 400,
        headers: getCorsHeaders(),
      },
    );
  }

  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { artistId, pinned } = result.data;
  const requesterAccountId = authResult.accountId;

  const existingArtist = await selectAccounts(artistId);
  if (!existingArtist.length) {
    return NextResponse.json(
      {
        status: "error",
        error: "Artist not found",
      },
      {
        status: 404,
        headers: getCorsHeaders(),
      },
    );
  }

  const hasAccess = await checkAccountArtistAccess(requesterAccountId, artistId);
  if (!hasAccess) {
    return NextResponse.json(
      {
        status: "error",
        error: "Forbidden",
      },
      {
        status: 403,
        headers: getCorsHeaders(),
      },
    );
  }

  return {
    artistId,
    pinned,
    requesterAccountId,
  };
}
