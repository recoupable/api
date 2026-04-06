import { type NextRequest } from "next/server";
import { handleArtistResearch } from "@/lib/research/handleArtistResearch";

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
  return handleArtistResearch(
    request,
    cmId => `/artist/${cmId}/where-people-listen`,
    undefined,
    data => {
      const raw =
        (data as { cities?: Record<string, Array<{ code2?: string; listeners?: number }>> })
          ?.cities || {};
      return {
        cities: Object.entries(raw)
          .map(([name, points]) => ({
            name,
            country: points[points.length - 1]?.code2 || "",
            listeners: points[points.length - 1]?.listeners || 0,
          }))
          .sort((a, b) => b.listeners - a.listeners),
      };
    },
  );
}
