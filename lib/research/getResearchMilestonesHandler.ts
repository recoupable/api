import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireArtist } from "@/lib/research/requireArtist";
import { getArtistResearch } from "@/lib/research/getArtistResearch";
import { jsonSuccess, jsonError } from "@/lib/networking/jsonResponse";

/**
 * GET /api/research/milestones
 *
 * Returns an artist's activity feed — playlist adds, chart entries, and other
 * notable events tracked by Chartmetric.
 *
 * @param request - The incoming HTTP request.
 * @returns The JSON response.
 */
export async function getResearchMilestonesHandler(request: NextRequest) {
  const gate = await requireArtist(request);
  if (gate instanceof NextResponse) return gate;

  const result = await getArtistResearch({
    artist: gate.artist,
    accountId: gate.accountId,
    path: cmId => `/artist/${cmId}/milestones`,
  });

  if ("error" in result) return jsonError(result.status, result.error);
  return jsonSuccess({
    milestones: (result.data as Record<string, unknown>)?.insights || [],
  });
}
