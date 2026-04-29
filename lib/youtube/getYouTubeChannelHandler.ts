import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateYouTubeChannelInfoRequest } from "@/lib/youtube/validateYouTubeChannelInfoRequest";
import { fetchYouTubeChannelInfo } from "@/lib/youtube/fetchYouTubeChannelInfo";

/**
 * Handles GET /api/youtube/channel-info — proxies the YouTube Data API
 * channel-info call after the request validator resolves+refreshes the
 * stored tokens. Always responds 200; clients infer "needs re-auth" from
 * `channels === null`.
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

    const channels = channelResult.success ? channelResult.channelData : null;
    return NextResponse.json(
      { status: "success", channels },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("Error in YouTube channel info API:", error);
    return NextResponse.json(
      { status: "success", channels: null },
      { status: 200, headers: getCorsHeaders() },
    );
  }
}
