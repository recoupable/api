import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireArtist } from "@/lib/research/requireArtist";
import { getArtistResearch } from "@/lib/research/getArtistResearch";
import { jsonSuccess, jsonError } from "@/lib/networking/jsonResponse";

/**
 * GET /api/research/profile
 *
 * Returns the full Chartmetric artist profile for the given artist.
 * Requires `artist` query param (name, numeric ID, or UUID).
 *
 * @param request - The incoming HTTP request.
 * @returns The JSON response.
 */
export async function getResearchProfileHandler(request: NextRequest) {
  const gate = await requireArtist(request);
  if (gate instanceof NextResponse) return gate;

  const result = await getArtistResearch({
    artist: gate.artist,
    accountId: gate.accountId,
    path: cmId => `/artist/${cmId}`,
  });

  if ("error" in result) return jsonError(result.status, result.error);
  const data = result.data;
  const body =
    typeof data === "object" && data !== null && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : { data };
  return jsonSuccess(body);
}
