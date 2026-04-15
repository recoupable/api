import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireArtist } from "@/lib/research/requireArtist";
import { getArtistResearch } from "@/lib/research/getArtistResearch";
import { jsonSuccess, jsonError } from "@/lib/networking/jsonResponse";

/**
 * GET /api/research/insights
 *
 * Returns noteworthy insights and highlights for the given artist
 * (e.g., trending metrics, chart movements, notable playlist adds).
 * Requires `artist` query param.
 *
 * @param request - The incoming HTTP request.
 * @returns The JSON response.
 */
export async function getResearchInsightsHandler(request: NextRequest) {
  const gate = await requireArtist(request);
  if (gate instanceof NextResponse) return gate;

  const result = await getArtistResearch({
    artist: gate.artist,
    accountId: gate.accountId,
    path: cmId => `/artist/${cmId}/noteworthy-insights`,
  });

  if ("error" in result) return jsonError(result.status, result.error);
  return jsonSuccess({ insights: Array.isArray(result.data) ? result.data : [] });
}
