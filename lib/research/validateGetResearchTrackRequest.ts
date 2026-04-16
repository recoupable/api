import { type NextRequest, NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { errorResponse } from "@/lib/networking/errorResponse";

export type ValidatedGetResearchTrackRequest = {
  accountId: string;
  q: string;
  artist: string | undefined;
};

/**
 * Validates `GET /api/research/track` — auth + required `q` query param, with
 * an optional `artist` param that's used downstream to disambiguate matches
 * against the search result's `artist_names`.
 *
 * @param request - The incoming HTTP request.
 */
export async function validateGetResearchTrackRequest(
  request: NextRequest,
): Promise<NextResponse | ValidatedGetResearchTrackRequest> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  if (!q) return errorResponse("q parameter is required", 400);

  const artist = searchParams.get("artist") ?? undefined;
  return { accountId: authResult.accountId, q, artist };
}
