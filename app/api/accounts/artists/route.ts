import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { validateAddArtistBody, type AddArtistBody } from "@/lib/accounts/validateAddArtistBody";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { resolveAddArtistAccountId } from "@/lib/accounts/resolveAddArtistAccountId";
import { addArtistToAccountHandler } from "@/lib/accounts/addArtistToAccountHandler";

/**
 * POST /api/accounts/artists
 *
 * Add an artist to the authenticated account's list of associated artists.
 * Requires authentication (x-api-key or Authorization bearer token); the
 * target account is derived from the credential. An optional email override
 * is allowed only when the caller has access to that account.
 * If the artist is already associated with the account, returns success.
 *
 * @param req - The incoming request with artistId (and optional email) in body
 * @returns NextResponse with success status or error
 */
export async function POST(req: NextRequest) {
  const body = await safeParseJson(req);

  const validated = validateAddArtistBody(body);
  if (validated instanceof NextResponse) {
    return validated;
  }
  const { email, artistId } = validated as AddArtistBody;

  const authResult = await validateAuthContext(req);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const accountIdOrError = await resolveAddArtistAccountId(authResult.accountId, email);
  if (accountIdOrError instanceof NextResponse) {
    return accountIdOrError;
  }

  return addArtistToAccountHandler({ accountId: accountIdOrError, artistId });
}

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns NextResponse with CORS headers
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(),
  });
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
