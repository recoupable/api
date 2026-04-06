import { type NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { handleArtistResearch } from "@/lib/research/handleArtistResearch";

/**
 * GET /api/research/metrics
 *
 * Returns platform-specific streaming/social metrics for the given artist.
 * Requires `artist` and `source` query params. Source is a platform like
 * "spotify", "youtube", "instagram", etc. and is embedded in the path.
 *
 * @param request - The incoming HTTP request.
 * @returns The JSON response.
 */
export async function getResearchMetricsHandler(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const source = searchParams.get("source");

  if (!source) {
    return NextResponse.json(
      { status: "error", error: "source parameter is required" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const VALID_SOURCES = [
    "spotify",
    "instagram",
    "tiktok",
    "twitter",
    "facebook",
    "youtube_channel",
    "youtube_artist",
    "soundcloud",
    "deezer",
    "twitch",
    "line",
    "melon",
    "wikipedia",
    "bandsintown",
  ];

  if (!VALID_SOURCES.includes(source)) {
    return NextResponse.json(
      { status: "error", error: `Invalid source. Must be one of: ${VALID_SOURCES.join(", ")}` },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  return handleArtistResearch(request, cmId => `/artist/${cmId}/stat/${source}`);
}
