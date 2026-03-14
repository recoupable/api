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
 * Scrapes a single social media profile by social_id.
 *
 * Body parameters:
 * - social_id (required): The unique identifier of the social profile
 *
 * @param request - The request object containing the body with social_id.
 * @returns A NextResponse with scraping results (runId and datasetId).
 */
export async function POST(request: NextRequest) {
  return postSocialScrapeHandler(request);
}
