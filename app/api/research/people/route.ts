import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { postResearchPeopleHandler } from "@/lib/research/postResearchPeopleHandler";

/**
 * OPTIONS /api/research/people — CORS preflight.
 *
 * @returns CORS-enabled 200 response
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * POST /api/research/people — Search for people in the music industry. Body: `{ query, num_results? }`.
 *
 * @param request - JSON body with `query` string
 * @returns JSON people results or error
 */
export async function POST(request: NextRequest) {
  return postResearchPeopleHandler(request);
}
