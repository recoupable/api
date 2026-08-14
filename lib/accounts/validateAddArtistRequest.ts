import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { validateAddArtistBody, type AddArtistBody } from "@/lib/accounts/validateAddArtistBody";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { resolveAddArtistAccountId } from "@/lib/accounts/resolveAddArtistAccountId";

/**
 * Validated params for adding an artist to an account.
 */
export interface AddArtistParams {
  accountId: string;
  artistId: string;
}

/**
 * Validates the full POST /api/accounts/artists request.
 *
 * Handles, in order:
 * 1. Body validation (`artistId` required, optional `email`) — a malformed
 *    body 400s before authentication is checked.
 * 2. Authentication (x-api-key or Bearer token).
 * 3. Target account resolution — defaults to the authenticated account; an
 *    `email` override is honored only when the caller has access to it.
 *
 * @param request - The incoming request
 * @returns A NextResponse error (400/401/403/404) or the validated params
 */
export async function validateAddArtistRequest(
  request: NextRequest,
): Promise<NextResponse | AddArtistParams> {
  const body = await safeParseJson(request);

  const validated = validateAddArtistBody(body);
  if (validated instanceof NextResponse) {
    return validated;
  }
  const { email, artistId } = validated as AddArtistBody;

  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const accountIdOrError = await resolveAddArtistAccountId(authResult.accountId, email);
  if (accountIdOrError instanceof NextResponse) {
    return accountIdOrError;
  }

  return { accountId: accountIdOrError, artistId };
}
