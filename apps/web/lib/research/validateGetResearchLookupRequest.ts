import { type NextRequest, NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { errorResponse } from "@/lib/networking/errorResponse";

const SPOTIFY_ARTIST_REGEX = /spotify\.com\/artist\/([a-zA-Z0-9]+)/;

export type ValidatedGetResearchLookupRequest = {
  accountId: string;
  spotifyId: string;
};

/**
 * Validates `GET /api/research/lookup` — auth + `url` (required Spotify artist
 * URL). Extracts the Spotify artist ID from the URL.
 *
 * @param request - The incoming HTTP request.
 */
export async function validateGetResearchLookupRequest(
  request: NextRequest,
): Promise<NextResponse | ValidatedGetResearchLookupRequest> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  if (!url) return errorResponse("url parameter is required", 400);

  const match = url.match(SPOTIFY_ARTIST_REGEX);
  if (!match) return errorResponse("url must be a valid Spotify artist URL", 400);

  return { accountId: authResult.accountId, spotifyId: match[1] };
}
