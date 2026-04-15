import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireArtist } from "@/lib/research/requireArtist";
import { handleArtistResearch } from "@/lib/research/handleArtistResearch";
import { successResponse } from "@/lib/networking/successResponse";
import { errorResponse } from "@/lib/networking/errorResponse";

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

  const result = await handleArtistResearch({
    artist: gate.artist,
    accountId: gate.accountId,
    path: cmId => `/artist/${cmId}/milestones`,
  });

  if ("error" in result) return errorResponse(result.error, result.status);
  return successResponse({
    milestones: (result.data as Record<string, unknown>)?.insights || [],
  });
}
