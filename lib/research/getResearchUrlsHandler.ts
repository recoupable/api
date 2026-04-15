import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireArtist } from "@/lib/research/requireArtist";
import { handleArtistResearch } from "@/lib/research/handleArtistResearch";
import { successResponse } from "@/lib/networking/successResponse";
import { errorResponse } from "@/lib/networking/errorResponse";

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
  const gate = await requireArtist(request);
  if (gate instanceof NextResponse) return gate;

  const result = await handleArtistResearch({
    artist: gate.artist,
    accountId: gate.accountId,
    path: cmId => `/artist/${cmId}/urls`,
  });

  if ("error" in result) return errorResponse(result.error, result.status);
  const data = result.data;
  return successResponse({
    urls: Array.isArray(data)
      ? data
      : Object.entries(data as Record<string, string>).map(([domain, url]) => ({ domain, url })),
  });
}
