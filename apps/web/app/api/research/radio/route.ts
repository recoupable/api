import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getResearchRadioHandler } from "@/lib/research/getResearchRadioHandler";

/**
 * OPTIONS /api/research/radio — CORS preflight.
 *
 * @returns CORS-enabled 200 response
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * GET /api/research/radio — List of radio stations.
 *
 * @param request - optional filter query params
 * @returns JSON radio station list or error
 */
export async function GET(request: NextRequest) {
  return getResearchRadioHandler(request);
}
