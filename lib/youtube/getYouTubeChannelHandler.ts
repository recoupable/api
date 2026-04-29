import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateYouTubeChannelInfoRequest } from "@/lib/youtube/validateYouTubeChannelInfoRequest";
import { fetchYouTubeChannelInfo } from "@/lib/youtube/fetchYouTubeChannelInfo";

/**
 * Handles GET /api/youtube/channel-info — proxies the YouTube Data API
 * channel-info call after the request validator resolves+refreshes the
 * stored tokens.
 *
 * Response codes:
 * - 200: success, returns `{ status: "success", channels: [...] }`
 * - 400: validation error (handled by the validator)
 * - 401: stored YouTube tokens can't be validated/refreshed (re-auth)
 * - 502: upstream YouTube API failure
 */
export async function getYouTubeChannelHandler(request: NextRequest) {
  const validated = await validateYouTubeChannelInfoRequest(request);
  if (validated instanceof NextResponse) {
    return validated;
  }

  try {
    const channelResult = await fetchYouTubeChannelInfo({
      accessToken: validated.tokens.access_token,
      refreshToken: validated.tokens.refresh_token || "",
      includeBranding: true,
    });

    if (!channelResult.success) {
      return NextResponse.json(
        { status: "error", message: "YouTube API error" },
        { status: 502, headers: getCorsHeaders() },
      );
    }

    return NextResponse.json(
      { status: "success", channels: channelResult.channelData },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("Error in YouTube channel info API:", error);
    return NextResponse.json(
      { status: "error", message: "YouTube API error" },
      { status: 502, headers: getCorsHeaders() },
    );
  }
}
