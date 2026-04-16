import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getResearchMilestonesHandler } from "@/lib/research/getResearchMilestonesHandler";

/**
 * OPTIONS /api/research/milestones — CORS preflight.
 *
 * @returns CORS-enabled 200 response
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * GET /api/research/milestones — Artist activity feed: playlist adds, chart entries, events. Requires `?artist=` query param.
 *
 * @param request - must include `artist` query param
 * @returns JSON milestone activity feed or error
 */
export async function GET(request: NextRequest) {
  return getResearchMilestonesHandler(request);
}
