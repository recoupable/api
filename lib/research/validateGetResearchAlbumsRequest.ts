import { type NextRequest, NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { errorResponse } from "@/lib/networking/errorResponse";

export type ValidatedGetResearchAlbumsRequest = {
  accountId: string;
  artistId: string;
};

/**
 * Validates `GET /api/research/albums` — auth + required numeric `artist_id`
 * (the Chartmetric artist ID). Discovery (search by name) is the caller's job
 * via `GET /api/research?type=artists&beta=true`; this endpoint is a thin
 * discography-lookup proxy.
 *
 * @param request - The incoming HTTP request.
 */
export async function validateGetResearchAlbumsRequest(
  request: NextRequest,
): Promise<NextResponse | ValidatedGetResearchAlbumsRequest> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const artistId = new URL(request.url).searchParams.get("artist_id");
  if (!artistId) return errorResponse("artist_id parameter is required", 400);
  if (!/^[1-9]\d*$/.test(artistId))
    return errorResponse("artist_id must be a positive integer", 400);

  return { accountId: authResult.accountId, artistId };
}
