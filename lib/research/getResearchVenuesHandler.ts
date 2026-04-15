import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireArtist } from "@/lib/research/requireArtist";
import { getArtistResearch } from "@/lib/research/getArtistResearch";
import { jsonSuccess, jsonError } from "@/lib/networking/jsonResponse";

/**
 * GET /api/research/venues
 *
 * Returns venues the artist has performed at, including capacity and location.
 *
 * @param request - The incoming HTTP request.
 * @returns The JSON response.
 */
export async function getResearchVenuesHandler(request: NextRequest) {
  const gate = await requireArtist(request);
  if (gate instanceof NextResponse) return gate;

  const result = await getArtistResearch({
    artist: gate.artist,
    accountId: gate.accountId,
    path: cmId => `/artist/${cmId}/venues`,
  });

  if ("error" in result) return jsonError(result.status, result.error);
  return jsonSuccess({ venues: Array.isArray(result.data) ? result.data : [] });
}
