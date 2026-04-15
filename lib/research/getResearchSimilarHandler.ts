import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireArtist } from "@/lib/research/requireArtist";
import { handleArtistResearch } from "@/lib/research/handleArtistResearch";
import { jsonSuccess, jsonError } from "@/lib/networking/jsonResponse";

const CONFIG_PARAMS = ["audience", "genre", "mood", "musicality"] as const;

/**
 * GET /api/research/similar
 *
 * Returns similar artists. Uses the configuration-based endpoint when any
 * of audience, genre, mood, or musicality params are provided (values: high/medium/low).
 * Falls back to the simpler related-artists endpoint when none are present.
 * Accepts optional `limit` query param.
 *
 * @param request - The incoming HTTP request.
 * @returns The JSON response.
 */
export async function getResearchSimilarHandler(request: NextRequest) {
  const gate = await requireArtist(request);
  if (gate instanceof NextResponse) return gate;

  const { searchParams } = new URL(request.url);
  const query: Record<string, string> = {};
  for (const key of CONFIG_PARAMS) {
    const val = searchParams.get(key);
    query[key] = val || "medium";
  }
  const limit = searchParams.get("limit");
  if (limit) query.limit = limit;

  const result = await handleArtistResearch({
    artist: gate.artist,
    accountId: gate.accountId,
    path: cmId => `/artist/${cmId}/similar-artists/by-configurations`,
    query,
  });

  if ("error" in result) return jsonError(result.status, result.error);
  const data = result.data;
  return jsonSuccess({
    artists: Array.isArray(data) ? data : (data as Record<string, unknown>)?.data || [],
    total: (data as Record<string, unknown>)?.total,
  });
}
