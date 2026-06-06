import { type NextRequest, NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { ensureResearchCredits } from "@/lib/research/ensureResearchCredits";
import { errorResponse } from "@/lib/networking/errorResponse";
import { PROVIDER_ID_REGEX } from "@/lib/research/providerId";

/**
 * Auth + artist identifier query param gate for artist-scoped research endpoints.
 * Also ensures the account has enough credits to cover the call (auto-recharging
 * via a saved card if short, returning a 402 NextResponse otherwise).
 *
 * Returns a `NextResponse` to short-circuit on auth, schema, or credit failures.
 * Otherwise returns the authenticated `accountId` and the `artist` query value.
 * `id` is accepted as a provider-neutral alias when callers already resolved
 * the artist through `/api/research/lookup`.
 *
 * @param request - The incoming HTTP request.
 */
export async function validateArtistRequest(
  request: NextRequest,
): Promise<NextResponse | { accountId: string; artist: string; artistId?: string }> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(request.url);
  const artist = searchParams.get("artist");
  const artistId = searchParams.get("id") ?? undefined;
  if (!artist && !artistId) return errorResponse("artist or id parameter is required", 400);
  if (artistId && !PROVIDER_ID_REGEX.test(artistId)) {
    return errorResponse("id must be a provider artist ID", 400);
  }

  const short = await ensureResearchCredits(authResult.accountId);
  if (short) return short;

  if (artistId) {
    return { accountId: authResult.accountId, artist: artistId, artistId };
  }

  return { accountId: authResult.accountId, artist: artist as string };
}
