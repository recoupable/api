import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { validateGetResearchPlaylistsRequest } from "@/lib/research/validateGetResearchPlaylistsRequest";
import { handleArtistResearch } from "@/lib/research/handleArtistResearch";
import { successResponse } from "@/lib/networking/successResponse";
import { errorResponse } from "@/lib/networking/errorResponse";

/**
 * Playlists handler — returns playlists featuring an artist. Supports `?platform=`, `?status=`, `?limit=`, `?sort=`, `?since=`, and playlist-type filters.
 *
 * @param request - must include `artist` query param
 * @returns JSON playlist placements or error
 */
export async function getResearchPlaylistsHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validateGetResearchPlaylistsRequest(request);
    if (validated instanceof NextResponse) return validated;

    const { searchParams } = new URL(request.url);

    const query: Record<string, string> = {};
    const limit = searchParams.get("limit");
    if (limit) query.limit = limit;
    const sort = searchParams.get("sort");
    if (sort) query.sortColumn = sort;
    const since = searchParams.get("since");
    if (since) query.since = since;

    const hasFilters =
      searchParams.get("editorial") ||
      searchParams.get("indie") ||
      searchParams.get("majorCurator") ||
      searchParams.get("popularIndie") ||
      searchParams.get("personalized") ||
      searchParams.get("chart");
    if (hasFilters) {
      if (searchParams.get("editorial")) query.editorial = searchParams.get("editorial")!;
      if (searchParams.get("indie")) query.indie = searchParams.get("indie")!;
      if (searchParams.get("majorCurator")) query.majorCurator = searchParams.get("majorCurator")!;
      if (searchParams.get("popularIndie")) query.popularIndie = searchParams.get("popularIndie")!;
      if (searchParams.get("personalized")) query.personalized = searchParams.get("personalized")!;
      if (searchParams.get("chart")) query.chart = searchParams.get("chart")!;
    } else {
      query.editorial = "true";
      query.indie = "true";
      query.majorCurator = "true";
      query.popularIndie = "true";
    }

    const { platform, status, ...rest } = validated;
    const result = await handleArtistResearch({
      ...rest,
      path: cmId => `/artist/${cmId}/${platform}/${status}/playlists`,
      query,
    });

    if ("error" in result) return errorResponse(result.error, result.status);
    return successResponse({ placements: Array.isArray(result.data) ? result.data : [] });
  } catch (error) {
    console.error("[ERROR] getResearchPlaylistsHandler:", error);
    return errorResponse("Internal error", 500);
  }
}
