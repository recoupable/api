import { type NextRequest, NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { ensureResearchCredits } from "@/lib/research/ensureResearchCredits";

export type ValidatedGetAlbumMeasurementsRequest = {
  accountId: string;
  spotifyAlbumId: string;
};

/**
 * Validates `GET /api/research/albums/{id}/measurements` — auth + research
 * credits. The album id comes from the path.
 *
 * @param request - The incoming HTTP request.
 * @param id - The Spotify album id from the path.
 */
export async function validateGetAlbumMeasurementsRequest(
  request: NextRequest,
  id: string,
): Promise<NextResponse | ValidatedGetAlbumMeasurementsRequest> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const short = await ensureResearchCredits(authResult.accountId);
  if (short) return short;

  return { accountId: authResult.accountId, spotifyAlbumId: id };
}
