import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { validateGetResearchSimilarRequest } from "@/lib/research/validateGetResearchSimilarRequest";
import { handleArtistResearch } from "@/lib/research/handleArtistResearch";
import { successResponse } from "@/lib/networking/successResponse";
import { errorResponse } from "@/lib/networking/errorResponse";

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
export async function getResearchSimilarHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validateGetResearchSimilarRequest(request);
    if (validated instanceof NextResponse) return validated;

    const query: Record<string, string> = {
      audience: validated.audience,
      genre: validated.genre,
      mood: validated.mood,
      musicality: validated.musicality,
    };
    if (validated.limit) query.limit = validated.limit;

    const result = await handleArtistResearch({
      artist: validated.artist,
      accountId: validated.accountId,
      path: cmId => `/artist/${cmId}/similar-artists/by-configurations`,
      query,
    });

    if ("error" in result) return errorResponse(result.error, result.status);
    const data = result.data;
    return successResponse({
      artists: Array.isArray(data) ? data : (data as Record<string, unknown>)?.data || [],
      total: (data as Record<string, unknown>)?.total,
    });
  } catch (error) {
    console.error("[ERROR] getResearchSimilarHandler:", error);
    return errorResponse("Internal error", 500);
  }
}
