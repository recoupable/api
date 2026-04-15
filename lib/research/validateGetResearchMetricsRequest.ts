import { type NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { validateArtistRequest } from "@/lib/research/validateArtistRequest";

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
] as const;

export type ValidatedGetResearchMetricsRequest = {
  accountId: string;
  artist: string;
  source: string;
};

/**
 * Validates `GET /api/research/metrics` — auth, `artist`, and `source` enum.
 *
 * @param request - The incoming HTTP request.
 */
export async function validateGetResearchMetricsRequest(
  request: NextRequest,
): Promise<NextResponse | ValidatedGetResearchMetricsRequest> {
  const source = new URL(request.url).searchParams.get("source");
  if (!source) return errorResponse("source parameter is required", 400);
  if (!VALID_SOURCES.includes(source as (typeof VALID_SOURCES)[number])) {
    return errorResponse(`Invalid source. Must be one of: ${VALID_SOURCES.join(", ")}`, 400);
  }

  const gate = await validateArtistRequest(request);
  if (gate instanceof NextResponse) return gate;

  return { ...gate, source };
}
