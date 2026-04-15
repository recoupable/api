import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireArtist } from "@/lib/research/requireArtist";
import { handleArtistResearch } from "@/lib/research/handleArtistResearch";
import { jsonSuccess, jsonError } from "@/lib/networking/jsonResponse";

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
    return jsonError(400, "source parameter is required");
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
    return jsonError(400, `Invalid source. Must be one of: ${VALID_SOURCES.join(", ")}`);
  }

  const gate = await requireArtist(request);
  if (gate instanceof NextResponse) return gate;

  const result = await handleArtistResearch({
    artist: gate.artist,
    accountId: gate.accountId,
    path: cmId => `/artist/${cmId}/stat/${source}`,
  });

  if ("error" in result) return jsonError(result.status, result.error);
  const data = result.data;
  const body =
    typeof data === "object" && data !== null && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : { data };
  return jsonSuccess(body);
}
