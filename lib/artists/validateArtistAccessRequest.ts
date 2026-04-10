import { NextRequest, NextResponse } from "next/server";
import { validateAccountParams } from "@/lib/accounts/validateAccountParams";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { checkAccountArtistAccess } from "@/lib/artists/checkAccountArtistAccess";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { selectAccounts } from "@/lib/supabase/accounts/selectAccounts";

export interface ValidatedArtistAccessRequest {
  artistId: string;
  requesterAccountId: string;
}

/**
 * Validates artist path params plus authenticated access to that artist.
 *
 * @param request - The incoming request
 * @param id - The artist account ID from the route
 * @returns The validated artist and requester IDs, or a NextResponse error
 */
export async function validateArtistAccessRequest(
  request: NextRequest,
  id: string,
): Promise<ValidatedArtistAccessRequest | NextResponse> {
  const validatedParams = validateAccountParams(id);
  if (validatedParams instanceof NextResponse) {
    return validatedParams;
  }

  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const artistId = validatedParams.id;
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
    requesterAccountId,
  };
}
