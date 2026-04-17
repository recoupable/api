import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { postResearchDeepHandler } from "@/lib/research/postResearchDeepHandler";

/**
 * OPTIONS /api/research/deep — CORS preflight.
 *
 * @returns CORS-enabled 200 response
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * POST /api/research/deep — Deep, comprehensive research with citations. Body: `{ query }`.
 *
 * @param request - JSON body with `query` string
 * @returns JSON research report with citations or error
 */
export async function POST(request: NextRequest) {
  return postResearchDeepHandler(request);
}
