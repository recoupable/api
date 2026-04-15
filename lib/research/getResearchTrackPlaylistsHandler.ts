import { type NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { deductCredits } from "@/lib/credits/deductCredits";
import { fetchChartmetric } from "@/lib/research/fetchChartmetric";
import { resolveTrack } from "@/lib/research/resolveTrack";

const VALID_PLATFORMS = ["spotify", "applemusic", "deezer", "amazon"];

/**
 * Track playlists handler — returns playlists featuring a specific track.
 * Accepts a Chartmetric track ID, or a track name + optional artist for Spotify-powered lookup.
 *
 * @param request - query params: id or q (+artist), platform, status, editorial, limit
 * @returns JSON playlist placements for the track or error
 */
export async function getResearchTrackPlaylistsHandler(
  request: NextRequest,
): Promise<NextResponse> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;
  const { accountId } = authResult;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const q = searchParams.get("q");
  const artist = searchParams.get("artist") || undefined;

  if (!id && !q) {
    return NextResponse.json(
      { status: "error", error: "id or q parameter is required" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const platform = searchParams.get("platform") || "spotify";
  if (!VALID_PLATFORMS.includes(platform)) {
    return NextResponse.json(
      {
        status: "error",
        error: `Invalid platform. Must be one of: ${VALID_PLATFORMS.join(", ")}`,
      },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const status = searchParams.get("status") || "current";
  if (status !== "current" && status !== "past") {
    return NextResponse.json(
      { status: "error", error: "status must be 'current' or 'past'" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  let trackId = id;

  if (!trackId) {
    const resolved = await resolveTrack(q!, artist);
    if (resolved.error) {
      return NextResponse.json(
        { status: "error", error: resolved.error },
        { status: 404, headers: getCorsHeaders() },
      );
    }
    trackId = resolved.id;
  }

  const queryParams: Record<string, string> = {};
  const limit = searchParams.get("limit");
  if (limit) queryParams.limit = limit;
  const offset = searchParams.get("offset");
  if (offset) queryParams.offset = offset;
  const since = searchParams.get("since");
  if (since) queryParams.since = since;
  const until = searchParams.get("until");
  if (until) queryParams.until = until;
  const sortColumn = searchParams.get("sort");
  if (sortColumn) queryParams.sortColumn = sortColumn;

  const filterParams = [
    "editorial",
    "indie",
    "majorCurator",
    "popularIndie",
    "personalized",
    "chart",
    "newMusicFriday",
    "thisIs",
    "radio",
    "brand",
  ];

  let hasFilters = false;
  for (const param of filterParams) {
    const value = searchParams.get(param);
    if (value !== null) {
      queryParams[param] = value;
      hasFilters = true;
    }
  }

  if (!hasFilters) {
    queryParams.editorial = "true";
    queryParams.indie = "true";
    queryParams.majorCurator = "true";
    queryParams.popularIndie = "true";
  }

  const result = await fetchChartmetric(
    `/track/${trackId}/${platform}/${status}/playlists`,
    queryParams,
  );

  if (result.status !== 200) {
    return NextResponse.json(
      { status: "error", error: `Request failed with status ${result.status}` },
      { status: result.status, headers: getCorsHeaders() },
    );
  }

  try {
    await deductCredits({ accountId, creditsToDeduct: 5 });
  } catch {
    // Credit deduction failed but data was fetched — don't block
  }

  return NextResponse.json(
    {
      status: "success",
      placements: Array.isArray(result.data) ? result.data : [],
    },
    { status: 200, headers: getCorsHeaders() },
  );
}
