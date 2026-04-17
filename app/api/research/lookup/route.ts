import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getResearchLookupHandler } from "@/lib/research/getResearchLookupHandler";

/**
 * OPTIONS /api/research/lookup — CORS preflight.
 *
 * @returns CORS-enabled 200 response
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * GET /api/research/lookup — Resolve a Spotify artist URL to cross-platform IDs. Requires `?url=` query param.
 *
 * @param request - must include `url` query param (Spotify URL)
 * @returns JSON cross-platform IDs or error
 */
export async function GET(request: NextRequest) {
  return getResearchLookupHandler(request);
}
