import { NextRequest, NextResponse } from "next/server";
import { validateAccountParams } from "@/lib/accounts/validateAccountParams";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validateAccountIdOverride } from "@/lib/auth/validateAccountIdOverride";

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

  const overrideResult = await validateAccountIdOverride({
    currentAccountId: authResult.accountId,
    targetAccountId: validatedParams.id,
  });
  if (overrideResult instanceof NextResponse) {
    return overrideResult;
  }

  return {
    artistId: overrideResult.accountId,
    requesterAccountId: authResult.accountId,
  };
}
