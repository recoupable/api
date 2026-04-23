import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { postSocialScrapeHandler } from "@/lib/socials/postSocialScrapeHandler";

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
 * POST /api/socials/{id}/scrape
 *
 * Triggers a social profile scraping job for the social with the given id.
 *
 * @param request - The request object.
 * @param options - Route options containing the async params.
 * @param options.params - Route params containing the social id.
 * @returns A NextResponse with `{ runId, datasetId }` on success.
 */
export async function POST(request: NextRequest, options: { params: Promise<{ id: string }> }) {
  const { id } = await options.params;
  return postSocialScrapeHandler(request, id);
}
