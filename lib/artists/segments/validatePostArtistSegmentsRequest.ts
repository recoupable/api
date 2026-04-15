import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { validateAccountParams } from "@/lib/accounts/validateAccountParams";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { checkAccountArtistAccess } from "@/lib/artists/checkAccountArtistAccess";
import { selectAccounts } from "@/lib/supabase/accounts/selectAccounts";
import {
  validatePostSegmentsBody,
  type PostSegmentsBody,
} from "@/lib/artists/segments/validatePostSegmentsBody";

export interface PostArtistSegmentsRequest {
  artistId: string;
  requesterAccountId: string;
  body: PostSegmentsBody;
}

/**
 * Validates POST /api/artists/{id}/segments: path id, authentication, body,
 * artist existence, and per-artist access.
 *
 * @param request - The incoming request
 * @param id - The artist account ID from the route
 * @returns The validated request context, or a NextResponse error
 */
export async function validatePostArtistSegmentsRequest(
  request: NextRequest,
  id: string,
): Promise<PostArtistSegmentsRequest | NextResponse> {
  const validatedParams = validateAccountParams(id);
  if (validatedParams instanceof NextResponse) {
    return validatedParams;
  }

  const rawBody = await safeParseJson(request);
  const validatedBody = validatePostSegmentsBody(rawBody);
  if (validatedBody instanceof NextResponse) {
    return validatedBody;
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
        error: "Unauthorized segment creation attempt",
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
    body: validatedBody,
  };
}
