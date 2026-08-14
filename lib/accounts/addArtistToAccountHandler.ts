import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { validateAddArtistRequest } from "@/lib/accounts/validateAddArtistRequest";
import { linkArtistToAccount } from "@/lib/accounts/linkArtistToAccount";

/**
 * Handler for POST /api/accounts/artists.
 *
 * Validates the request (body + authentication + target-account resolution),
 * then links the artist to the resolved account. The target account is derived
 * from the credential; an optional `email` override is honored only when the
 * caller has access to that account.
 *
 * @param request - The incoming request
 * @returns NextResponse with success status or a validation error
 */
export async function addArtistToAccountHandler(request: NextRequest): Promise<NextResponse> {
  const validated = await validateAddArtistRequest(request);
  if (validated instanceof NextResponse) {
    return validated;
  }

  return linkArtistToAccount(validated);
}
