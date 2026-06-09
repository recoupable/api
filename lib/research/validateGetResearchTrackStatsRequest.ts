import { type NextRequest, NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { ensureResearchCredits } from "@/lib/research/ensureResearchCredits";
import { errorResponse } from "@/lib/networking/errorResponse";

/** Track identifiers — exactly one is required. */
const IDENTIFIER_PARAMS = [
  "isrc",
  "songstats_track_id",
  "spotify_track_id",
  "apple_music_track_id",
] as const;

/** Optional passthroughs forwarded 1:1 to Songstats `enterprise/v1/tracks/stats`. */
const OPTIONAL_PARAMS = [
  "with_playlists",
  "with_charts",
  "with_stations",
  "with_videos",
  "with_links",
  "only_current",
  "limit",
  "offset",
] as const;

export type ValidatedGetResearchTrackStatsRequest = {
  accountId: string;
  /** Query params to forward verbatim to Songstats. */
  params: Record<string, string>;
};

/**
 * Validates `GET /api/research/track/stats` — auth, a single track identifier
 * (`isrc` / `songstats_track_id` / `spotify_track_id` / `apple_music_track_id`),
 * a required `source`, and research credits. Collects the identifier + `source`
 * + optional passthroughs into `params` for a 1:1 Songstats passthrough.
 *
 * @param request - The incoming HTTP request.
 */
export async function validateGetResearchTrackStatsRequest(
  request: NextRequest,
): Promise<NextResponse | ValidatedGetResearchTrackStatsRequest> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(request.url);

  const identifiers = IDENTIFIER_PARAMS.filter(name => searchParams.get(name));
  if (identifiers.length === 0) {
    return errorResponse(
      `A track identifier is required (one of: ${IDENTIFIER_PARAMS.join(", ")})`,
      400,
    );
  }

  const source = searchParams.get("source");
  if (!source) return errorResponse("source parameter is required", 400);

  const short = await ensureResearchCredits(authResult.accountId);
  if (short) return short;

  const params: Record<string, string> = { source };
  for (const name of [...IDENTIFIER_PARAMS, ...OPTIONAL_PARAMS]) {
    const value = searchParams.get(name);
    if (value !== null) params[name] = value;
  }

  return { accountId: authResult.accountId, params };
}
