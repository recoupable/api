import { type NextRequest, NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { jsonError } from "@/lib/networking/jsonResponse";

/**
 * Auth + `artist` query param gate for artist-scoped research endpoints.
 * Returns a `NextResponse` to short-circuit on auth or validation failures,
 * otherwise returns the authenticated `accountId` and the `artist` query value.
 *
 * @param request - The incoming HTTP request.
 */
export async function requireArtist(
  request: NextRequest,
): Promise<NextResponse | { accountId: string; artist: string }> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const artist = new URL(request.url).searchParams.get("artist");
  if (!artist) return jsonError(400, "artist parameter is required");

  return { accountId: authResult.accountId, artist };
}
