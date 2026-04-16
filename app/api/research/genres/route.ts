import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getResearchGenresHandler } from "@/lib/research/getResearchGenresHandler";

/**
 * OPTIONS /api/research/genres — CORS preflight.
 *
 * @returns CORS-enabled 200 response
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * GET /api/research/genres — All available genre IDs and names.
 *
 * @param request - no required query params
 * @returns JSON genre list or error
 */
export async function GET(request: NextRequest) {
  return getResearchGenresHandler(request);
}
