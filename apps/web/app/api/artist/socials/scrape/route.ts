import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { postArtistSocialsScrapeHandler } from "@/lib/artist/postArtistSocialsScrapeHandler";

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns A NextResponse with CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(),
  });
}

/**
 * POST /api/artist/socials/scrape
 *
 * Scrapes all social media profiles associated with an artist account.
 *
 * Body parameters:
 * - artist_account_id (required): The unique identifier of the artist account
 *
 * @param request - The request object containing the body with artist_account_id.
 * @returns A NextResponse with scraping results.
 */
export async function POST(request: NextRequest) {
  return postArtistSocialsScrapeHandler(request);
}
