import { NextRequest, NextResponse } from "next/server";
import { validateAccountParams } from "@/lib/accounts/validateAccountParams";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { checkAccountArtistAccess } from "@/lib/artists/checkAccountArtistAccess";

export interface GetArtistRequest {
  artistId: string;
  requesterAccountId: string;
}

/**
 * Validates GET /api/artists/{id} path params and authentication.
 *
 * @param request - The incoming request
 * @param id - The artist account ID from the route
 * @returns The validated artist ID plus requester context, or a NextResponse error
 */
export async function validateGetArtistRequest(
  request: NextRequest,
  id: string,
): Promise<GetArtistRequest | NextResponse> {
  const validatedParams = validateAccountParams(id);
  if (validatedParams instanceof NextResponse) {
    return validatedParams;
  }

  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  if (validatedParams.id !== authResult.accountId) {
    const hasArtistAccess = await checkAccountArtistAccess(
      authResult.accountId,
      validatedParams.id,
    );

    if (!hasArtistAccess) {
      return NextResponse.json(
        { status: "error", error: "Access denied to specified artist" },
        { status: 403, headers: getCorsHeaders() },
      );
    }
  }

  return {
    artistId: validatedParams.id,
    requesterAccountId: authResult.accountId,
  };
}
