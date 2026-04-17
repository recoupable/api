import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { postResearchExtractHandler } from "@/lib/research/postResearchExtractHandler";

/**
 * OPTIONS /api/research/extract — CORS preflight.
 *
 * @returns CORS-enabled 200 response
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * POST /api/research/extract — Extract clean markdown from URLs. Body: `{ urls }`.
 *
 * @param request - JSON body with `urls` array
 * @returns JSON extracted markdown content or error
 */
export async function POST(request: NextRequest) {
  return postResearchExtractHandler(request);
}
