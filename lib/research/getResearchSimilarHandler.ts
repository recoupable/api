import { type NextRequest } from "next/server";
import { handleArtistResearch } from "@/lib/research/handleArtistResearch";

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
  return handleArtistResearch(
    request,
    cmId => `/artist/${cmId}/similar-artists/by-configurations`,
    sp => {
      const params: Record<string, string> = {};
      for (const key of CONFIG_PARAMS) {
        const val = sp.get(key);
        params[key] = val || "medium";
      }
      const limit = sp.get("limit");
      if (limit) params.limit = limit;
      return params;
    },
    data => ({
      artists: Array.isArray(data) ? data : (data as Record<string, unknown>)?.data || [],
      total: (data as Record<string, unknown>)?.total,
    }),
  );
}
