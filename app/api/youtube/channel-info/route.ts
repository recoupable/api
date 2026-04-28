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
 * Validates+refreshes the YouTube tokens stored in `youtube_tokens` for the
 * given artist account, then proxies the YouTube Data API. Returns
 * `{ success, channels, tokenStatus }`.
 *
 * tokenStatus ∈ "missing_param" | "invalid" | "api_error" | "error" | "valid".
 *
 * @param request - The incoming request.
 * @returns A NextResponse with the YouTube channel-info response shape.
 */
export async function GET(request: NextRequest) {
  return getYouTubeChannelHandler(request);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
