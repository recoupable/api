import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getInstagramCommentsHandler } from "@/lib/apify/instagram/getInstagramCommentsHandler";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

/**
 * CORS preflight.
 *
 * @returns 200 response with CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * GET /api/instagram/comments — starts an Apify Instagram comments scrape for the given post URLs.
 *
 * @param request - Query: `postUrls` (array, min 1, repeatable), `resultsLimit` (default 10000),
 *   `isNewestComments` (optional boolean), `webhooks` (optional base64 JSON).
 * @returns JSON with `{ runId, datasetId }` on success (wire parity with legacy ApifyScraperResult).
 */
export async function GET(request: NextRequest) {
  return getInstagramCommentsHandler(request);
}
