import { type NextRequest } from "next/server";
import { handleArtistResearch } from "@/lib/research/handleArtistResearch";

/**
 * GET /api/research/urls
 *
 * Returns all known platform URLs (Spotify, Apple Music, YouTube, socials, etc.)
 * for the given artist.
 * Requires `artist` query param.
 *
 * @param request - The incoming HTTP request.
 * @returns The JSON response.
 */
export async function getResearchUrlsHandler(request: NextRequest) {
  return handleArtistResearch(
    request,
    cmId => `/artist/${cmId}/urls`,
    undefined,
    data => ({
      urls: Array.isArray(data)
        ? data
        : Object.entries(data as Record<string, string>).map(([domain, url]) => ({
            domain,
            url,
          })),
    }),
  );
}
