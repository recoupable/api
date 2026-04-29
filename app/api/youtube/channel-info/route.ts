import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getYouTubeChannelHandler } from "@/lib/youtube/getYouTubeChannelHandler";

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns A NextResponse with CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(),
  });
}

/**
 * GET /api/youtube/channel-info?artist_account_id=<uuid>
 *
 * Validates+refreshes stored YouTube tokens, then proxies the YouTube
 * Data API. Always responds 200; clients infer "needs re-auth" from
 * `channels === null`.
 *
 * @param request - The incoming request.
 * @returns A NextResponse with `{ status: "success", channels }`.
 */
export async function GET(request: NextRequest) {
  return getYouTubeChannelHandler(request);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
