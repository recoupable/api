import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getInstagramProfilesHandler } from "@/lib/apify/instagram/getInstagramProfilesHandler";

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
 * GET /api/instagram/profiles — starts an Apify Instagram profile scrape for the given handles.
 *
 * @param request - Incoming request. Query: `handles` (array, min 1), `webhooks` (optional base64 JSON).
 * @returns JSON response with `{ runId, datasetId }`.
 */
export async function GET(request: NextRequest) {
  return getInstagramProfilesHandler(request);
}
