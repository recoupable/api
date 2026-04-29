import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateYouTubeChannelInfoRequest } from "@/lib/youtube/validateYouTubeChannelInfoRequest";
import { fetchYouTubeChannelInfo } from "@/lib/youtube/fetchYouTubeChannelInfo";

/**
 * Handles GET /api/youtube/channel-info — proxies the YouTube Data API
 * channel-info call after the request validator resolves+refreshes the
 * stored tokens. Mirrors chat's response shapes/status codes 1:1 so chat
 * callers can migrate with a base-URL swap.
 *
 * @param request - The incoming request.
 * @returns A NextResponse with `{ success, channels, tokenStatus }`.
 */
export async function getYouTubeChannelHandler(request: NextRequest): Promise<NextResponse> {
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

    if (channelResult.success === false) {
      return NextResponse.json(
        {
          success: false,
          error: channelResult.error.message,
          tokenStatus: "api_error",
          channels: null,
        },
        { status: 200, headers: getCorsHeaders() },
      );
    }

    return NextResponse.json(
      { success: true, channels: channelResult.channelData, tokenStatus: "valid" },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("Error in YouTube channel info API:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch YouTube channel information",
        tokenStatus: "error",
        channels: null,
      },
      { status: 200, headers: getCorsHeaders() },
    );
  }
}
