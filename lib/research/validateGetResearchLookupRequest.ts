import { type NextRequest, NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { ensureResearchCredits } from "@/lib/research/ensureResearchCredits";
import { errorResponse } from "@/lib/networking/errorResponse";

const SPOTIFY_ID_REGEX = /^[A-Za-z0-9]{22}$/;
const SPOTIFY_ARTIST_REGEX = /spotify\.com\/artist\/([A-Za-z0-9]{22})(?:[/?#]|$)/;

export type ValidatedGetResearchLookupRequest = {
  accountId: string;
  spotifyId: string;
};

/**
 * Validates `GET /api/research/lookup` — auth plus a Spotify artist URL or ID.
 * Extracts or passes through the Spotify artist ID.
 *
 * @param request - The incoming HTTP request.
 */
export async function validateGetResearchLookupRequest(
  request: NextRequest,
): Promise<NextResponse | ValidatedGetResearchLookupRequest> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(request.url);
  const directSpotifyId = searchParams.get("spotifyId");
  if (directSpotifyId) {
    if (!SPOTIFY_ID_REGEX.test(directSpotifyId)) {
      return errorResponse("spotifyId must be a valid Spotify artist ID", 400);
    }

    const short = await ensureResearchCredits(authResult.accountId);
    if (short) return short;

    return { accountId: authResult.accountId, spotifyId: directSpotifyId };
  }

  const url = searchParams.get("url");
  if (!url) return errorResponse("url parameter is required", 400);

  const match = url.match(SPOTIFY_ARTIST_REGEX);
  if (!match) return errorResponse("url must be a valid Spotify artist URL", 400);

  const short = await ensureResearchCredits(authResult.accountId);
  if (short) return short;

  return { accountId: authResult.accountId, spotifyId: match[1] };
}
