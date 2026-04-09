import { NextRequest, NextResponse } from "next/server";
import { validateAccountParams } from "@/lib/accounts/validateAccountParams";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

export interface DeleteArtistRequest {
  artistId: string;
  requesterAccountId: string;
}

/**
 * Validates DELETE /api/artists/{id} path params and authentication.
 *
 * @param request - The incoming request
 * @param id - The artist account ID from the route
 * @returns The validated artist ID plus requester context, or a NextResponse error
 */
export async function validateDeleteArtistRequest(
  request: NextRequest,
  id: string,
): Promise<DeleteArtistRequest | NextResponse> {
  const validatedParams = validateAccountParams(id);
  if (validatedParams instanceof NextResponse) {
    return validatedParams;
  }

  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  return {
    artistId: validatedParams.id,
    requesterAccountId: authResult.accountId,
  };
}
