import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { postResearchWebHandler } from "@/lib/research/postResearchWebHandler";

/**
 * OPTIONS /api/research/web — CORS preflight.
 *
 * @returns CORS-enabled 200 response
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * POST /api/research/web — Search the web for real-time information. Body: `{ query, max_results?, country? }`.
 *
 * @param request - JSON body with `query` string
 * @returns JSON search results with formatted markdown or error
 */
export async function POST(request: NextRequest) {
  return postResearchWebHandler(request);
}
