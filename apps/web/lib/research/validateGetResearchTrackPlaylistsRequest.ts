import { type NextRequest, NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { errorResponse } from "@/lib/networking/errorResponse";

const VALID_PLATFORMS = ["spotify", "applemusic", "deezer", "amazon"];
const FILTER_PARAMS = [
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
] as const;

export type ValidatedGetResearchTrackPlaylistsRequest = {
  accountId: string;
  id: string | null;
  q: string | null;
  artist: string | undefined;
  platform: string;
  status: string;
  filters: Record<string, string>;
  pagination: Record<string, string>;
};

/**
 * Validates `GET /api/research/track/playlists` — auth + requires either `id`
 * or `q`. Validates `platform` (default "spotify") and `status` (default
 * "current"). Collects optional filter flags (editorial, indie, majorCurator,
 * popularIndie, personalized, chart, newMusicFriday, thisIs, radio, brand) and
 * pagination/sort (limit, offset, since, until, sort).
 *
 * @param request - The incoming HTTP request.
 */
export async function validateGetResearchTrackPlaylistsRequest(
  request: NextRequest,
): Promise<NextResponse | ValidatedGetResearchTrackPlaylistsRequest> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const q = searchParams.get("q");
  const artist = searchParams.get("artist") || undefined;

  if (!id && !q) return errorResponse("id or q parameter is required", 400);

  const platform = searchParams.get("platform") || "spotify";
  if (!VALID_PLATFORMS.includes(platform)) {
    return errorResponse(`Invalid platform. Must be one of: ${VALID_PLATFORMS.join(", ")}`, 400);
  }

  const status = searchParams.get("status") || "current";
  if (status !== "current" && status !== "past") {
    return errorResponse("status must be 'current' or 'past'", 400);
  }

  const filters: Record<string, string> = {};
  let hasFilters = false;
  for (const param of FILTER_PARAMS) {
    const value = searchParams.get(param);
    if (value !== null) {
      filters[param] = value;
      hasFilters = true;
    }
  }
  if (!hasFilters) {
    filters.editorial = "true";
    filters.indie = "true";
    filters.majorCurator = "true";
    filters.popularIndie = "true";
  }

  const pagination: Record<string, string> = {};
  const limit = searchParams.get("limit");
  if (limit) pagination.limit = limit;
  const offset = searchParams.get("offset");
  if (offset) pagination.offset = offset;
  const since = searchParams.get("since");
  if (since) pagination.since = since;
  const until = searchParams.get("until");
  if (until) pagination.until = until;
  const sortColumn = searchParams.get("sort");
  if (sortColumn) pagination.sortColumn = sortColumn;

  return {
    accountId: authResult.accountId,
    id,
    q,
    artist,
    platform,
    status,
    filters,
    pagination,
  };
}
