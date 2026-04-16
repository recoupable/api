import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getResearchDiscoverHandler } from "@/lib/research/getResearchDiscoverHandler";

/**
 * OPTIONS /api/research/discover — CORS preflight.
 *
 * @returns CORS-enabled 200 response
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * GET /api/research/discover — Discover artists by genre, country, and growth criteria. Supports `?genre=`, `?country=`, `?sort=`, `?limit=` filters.
 *
 * @param request - filter criteria via query params
 * @returns JSON array of matching artists or error
 */
export async function GET(request: NextRequest) {
  return getResearchDiscoverHandler(request);
}
