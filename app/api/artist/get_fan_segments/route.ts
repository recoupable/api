import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getFanSegmentsHandler } from "@/lib/fan-segments/getFanSegmentsHandler";

/**
 * GET /api/artist/get_fan_segments
 *
 * Fetches fan segments for a given artist by looking up their social accounts.
 *
 * Query params:
 *  - artistId — the artist account ID
 */
export async function GET(req: NextRequest) {
  const artistId = req.nextUrl.searchParams.get("artistId") ?? "";

  return getFanSegmentsHandler({ artistId });
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
