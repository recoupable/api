import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireArtist } from "@/lib/research/requireArtist";
import { handleArtistResearch } from "@/lib/research/handleArtistResearch";
import { successResponse } from "@/lib/networking/successResponse";
import { errorResponse } from "@/lib/networking/errorResponse";

/**
 * GET /api/research/cities
 *
 * Returns geographic listening data showing where people listen to the artist.
 * Requires `artist` query param.
 *
 * @param request - The incoming HTTP request.
 * @returns The JSON response.
 */
export async function getResearchCitiesHandler(request: NextRequest) {
  const gate = await requireArtist(request);
  if (gate instanceof NextResponse) return gate;

  const result = await handleArtistResearch({
    artist: gate.artist,
    accountId: gate.accountId,
    path: cmId => `/artist/${cmId}/where-people-listen`,
  });

  if ("error" in result) return errorResponse(result.error, result.status);

  const raw =
    (result.data as { cities?: Record<string, Array<{ code2?: string; listeners?: number }>> })
      ?.cities || {};
  const cities = Object.entries(raw)
    .map(([name, points]) => ({
      name,
      country: points[points.length - 1]?.code2 || "",
      listeners: points[points.length - 1]?.listeners || 0,
    }))
    .sort((a, b) => b.listeners - a.listeners);

  return successResponse({ cities });
}
