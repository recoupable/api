import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateYouTubeChannelQuery } from "@/lib/youtube/validateYouTubeChannelQuery";
import { validateYouTubeTokens } from "@/lib/youtube/validateYouTubeTokens";
import { fetchYouTubeChannelInfo } from "@/lib/youtube/fetchYouTubeChannelInfo";

/**
 * Handles GET /api/youtube/channel-info — validates+refreshes the stored
 * YouTube tokens for the given artist account, then proxies the YouTube
 * Data API channel-info call. Mirrors chat's response shapes/status codes
 * 1:1 so chat callers can migrate with a base-URL swap.
 *
 * @param request - The incoming request.
 * @returns A NextResponse with `{ success, channels, tokenStatus }`.
 */
export async function getYouTubeChannelHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = validateYouTubeChannelQuery(request);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const tokenValidation = await validateYouTubeTokens(validated.artist_account_id);
    if (!tokenValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "YouTube authentication required",
          tokenStatus: "invalid",
          channels: null,
        },
        {
          status: 200,
          headers: getCorsHeaders(),
        },
      );
    }

    const channelResult = await fetchYouTubeChannelInfo({
      accessToken: tokenValidation.tokens.access_token,
      refreshToken: tokenValidation.tokens.refresh_token || "",
      includeBranding: true,
    });

    if (!channelResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: channelResult.error.message,
          tokenStatus: "api_error",
          channels: null,
        },
        {
          status: 200,
          headers: getCorsHeaders(),
        },
      );
    }

    return NextResponse.json(
      {
        success: true,
        channels: channelResult.channelData,
        tokenStatus: "valid",
      },
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  } catch (error) {
    console.error("Error in YouTube channel info API:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch YouTube channel information",
        details: error instanceof Error ? error.message : "Unknown error",
        tokenStatus: "error",
        channels: null,
      },
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  }
}
