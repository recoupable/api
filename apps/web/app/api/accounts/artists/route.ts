import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { validateAddArtistBody, type AddArtistBody } from "@/lib/accounts/validateAddArtistBody";
import { addArtistToAccountHandler } from "@/lib/accounts/addArtistToAccountHandler";

/**
 * POST /api/accounts/artists
 *
 * Add an artist to an account's list of associated artists.
 * If the artist is already associated with the account, returns success.
 *
 * @param req - The incoming request with email and artistId in body
 * @returns NextResponse with success status or error
 */
export async function POST(req: NextRequest) {
  const body = await safeParseJson(req);

  const validated = validateAddArtistBody(body);
  if (validated instanceof NextResponse) {
    return validated;
  }

  return addArtistToAccountHandler(validated as AddArtistBody);
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
