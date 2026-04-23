import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getSongsHandler } from "@/lib/songs/getSongsHandler";

/**
 * CORS preflight.
 *
 * @returns 200 with CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(),
  });
}

/**
 * GET /api/songs — list songs with their associated artist accounts.
 *
 * Optional query filters:
 * - `isrc`: match a single ISRC code.
 * - `artist_account_id`: match songs tied to a given artist account (UUID).
 *
 * Results are ordered by `updated_at` DESC. Authentication required
 * (`x-api-key` or `Authorization: Bearer`).
 *
 * @param request - Incoming request.
 * @returns `{ status: "success", songs }` with flattened `artists` per song.
 */
export async function GET(request: NextRequest) {
  return getSongsHandler(request);
}
