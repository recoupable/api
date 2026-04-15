import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireArtist } from "@/lib/research/requireArtist";
import { handleArtistResearch } from "@/lib/research/handleArtistResearch";
import { jsonSuccess, jsonError } from "@/lib/networking/jsonResponse";

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
    return jsonError(400, `Invalid platform. Must be one of: ${VALID_PLATFORMS.join(", ")}`);
  }

  const gate = await requireArtist(request);
  if (gate instanceof NextResponse) return gate;

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

  const result = await handleArtistResearch({
    artist: gate.artist,
    accountId: gate.accountId,
    path: cmId => `/artist/${cmId}/${platform}/${status}/playlists`,
    query,
  });

  if ("error" in result) return jsonError(result.status, result.error);
  return jsonSuccess({ placements: Array.isArray(result.data) ? result.data : [] });
}
