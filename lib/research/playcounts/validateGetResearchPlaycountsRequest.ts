import { type NextRequest, NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { ensureResearchCredits } from "@/lib/research/ensureResearchCredits";
import { errorResponse } from "@/lib/networking/errorResponse";

export type ValidatedGetResearchPlaycountsRequest = {
  accountId: string;
  spotifyAlbumId: string;
};

/**
 * Validates `GET /api/research/playcounts` — auth, a required
 * `spotify_album_id`, and research credits.
 *
 * @param request - The incoming HTTP request.
 */
export async function validateGetResearchPlaycountsRequest(
  request: NextRequest,
): Promise<NextResponse | ValidatedGetResearchPlaycountsRequest> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(request.url);

  const spotifyAlbumId = searchParams.get("spotify_album_id");
  if (!spotifyAlbumId) return errorResponse("spotify_album_id parameter is required", 400);

  const short = await ensureResearchCredits(authResult.accountId);
  if (short) return short;

  return { accountId: authResult.accountId, spotifyAlbumId };
}
