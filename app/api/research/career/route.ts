import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getResearchCareerHandler } from "@/lib/research/getResearchCareerHandler";

/**
 * OPTIONS /api/research/career — CORS preflight.
 *
 * @returns CORS-enabled 200 response
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * GET /api/research/career — Artist career history and milestones. Requires `?artist=` query param.
 *
 * @param request - must include `artist` query param
 * @returns JSON career timeline or error
 */
export async function GET(request: NextRequest) {
  return getResearchCareerHandler(request);
}
