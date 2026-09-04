import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getRunningAgentHandler } from "@/lib/running-agent/getRunningAgentHandler";

/**
 * GET /api/get_running_agent
 *
 * Returns the most recently updated non-terminal agent status for a given artist.
 *
 * Query params:
 *  - artistId — the artist account ID
 */
export async function GET(req: NextRequest) {
  const artistId = req.nextUrl.searchParams.get("artistId") ?? "";

  return getRunningAgentHandler({ artistId });
}

/**
 * OPTIONS handler for CORS preflight requests.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
