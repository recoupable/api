import { type NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { handleArtistResearch } from "@/lib/research/handleArtistResearch";

/**
 * Playlists handler — returns playlists featuring an artist. Supports `?platform=`, `?status=`, `?limit=`, `?sort=`, `?since=`, and playlist-type filters.
 *
 * @param request - must include `artist` query param
 * @returns JSON playlist placements or error
 */
export async function getResearchPlaylistsHandler(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const platform = searchParams.get("platform") || "spotify";
  const status = searchParams.get("status") || "current";

  const VALID_PLATFORMS = ["spotify", "applemusic", "deezer", "amazon", "youtube"];
  if (!VALID_PLATFORMS.includes(platform)) {
    return NextResponse.json(
      { status: "error", error: `Invalid platform. Must be one of: ${VALID_PLATFORMS.join(", ")}` },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  return handleArtistResearch(
    request,
    cmId => `/artist/${cmId}/${platform}/${status}/playlists`,
    sp => {
      const params: Record<string, string> = {};
      const limit = sp.get("limit");
      if (limit) params.limit = limit;
      const sort = sp.get("sort");
      if (sort) params.sortColumn = sort;
      const since = sp.get("since");
      if (since) params.since = since;

      const hasFilters =
        sp.get("editorial") ||
        sp.get("indie") ||
        sp.get("majorCurator") ||
        sp.get("popularIndie") ||
        sp.get("personalized") ||
        sp.get("chart");
      if (hasFilters) {
        if (sp.get("editorial")) params.editorial = sp.get("editorial")!;
        if (sp.get("indie")) params.indie = sp.get("indie")!;
        if (sp.get("majorCurator")) params.majorCurator = sp.get("majorCurator")!;
        if (sp.get("popularIndie")) params.popularIndie = sp.get("popularIndie")!;
        if (sp.get("personalized")) params.personalized = sp.get("personalized")!;
        if (sp.get("chart")) params.chart = sp.get("chart")!;
      } else {
        params.editorial = "true";
        params.indie = "true";
        params.majorCurator = "true";
        params.popularIndie = "true";
      }

      return params;
    },
    data => ({ placements: Array.isArray(data) ? data : [] }),
  );
}
