import { NextRequest } from "next/server";
import { getArtistSegmentsHandler } from "@/lib/artist/getArtistSegmentsHandler";

/**
 * GET /api/artist/segments
 *
 * Retrieves all segments associated with an artist account.
 *
 * Query parameters:
 * - artist_account_id (required): The unique identifier of the artist account
 * - page (optional): Page number for pagination (default: 1)
 * - limit (optional): Number of segments per page (default: 20, max: 100)
 *
 * @param request - The request object containing query parameters.
 * @returns A NextResponse with segments and pagination metadata.
 */
export async function GET(request: NextRequest) {
  return getArtistSegmentsHandler(request);
}
