import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { checkAccountArtistAccess } from "@/lib/artists/checkAccountArtistAccess";
import { validateYouTubeTokens } from "@/lib/youtube/validateYouTubeTokens";

export const youTubeChannelInfoRequestSchema = z.object({
  artist_account_id: z
    .string({ message: "artist_account_id is required" })
    .min(1, "artist_account_id is required"),
});

/**
 * Validates GET /api/youtube/channel-info: enforces auth + artist-access
 * before parsing the `artist_account_id` query param and resolving the
 * stored YouTube tokens (refreshing if expired).
 *
 * Order matters: anonymous callers can never reach validateYouTubeTokens
 * (which would otherwise leak token-row presence via 401 vs. 200), and a
 * caller without access to the artist gets a 403 instead of probing
 * arbitrary UUIDs.
 *
 * On token validation/refresh failure, returns 401 so clients can prompt
 * re-auth.
 */
export async function validateYouTubeChannelInfoRequest(request: NextRequest) {
  const auth = await validateAuthContext(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const params = Object.fromEntries(searchParams.entries());

  const result = youTubeChannelInfoRequestSchema.safeParse(params);

  if (!result.success) {
    return NextResponse.json(
      { status: "error", message: result.error.issues[0].message },
      {
        status: 400,
        headers: getCorsHeaders(),
      },
    );
  }

  const hasAccess = await checkAccountArtistAccess(auth.accountId, result.data.artist_account_id);
  if (!hasAccess) {
    return NextResponse.json(
      { status: "error", message: "forbidden" },
      {
        status: 403,
        headers: getCorsHeaders(),
      },
    );
  }

  try {
    const tokens = await validateYouTubeTokens(result.data.artist_account_id);
    return { artist_account_id: result.data.artist_account_id, tokens };
  } catch (error) {
    console.error(
      `YouTube token validation/refresh failed for account ${result.data.artist_account_id}:`,
      error,
    );
    return NextResponse.json(
      { status: "error", message: "YouTube authentication required" },
      {
        status: 401,
        headers: getCorsHeaders(),
      },
    );
  }
}
