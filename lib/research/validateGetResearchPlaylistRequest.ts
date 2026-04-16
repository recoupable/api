import { type NextRequest, NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { errorResponse } from "@/lib/networking/errorResponse";

const VALID_PLATFORMS = ["spotify", "applemusic", "deezer", "amazon", "youtube"];

export type ValidatedGetResearchPlaylistRequest = {
  accountId: string;
  platform: string;
  id: string;
};

/**
 * Validates `GET /api/research/playlist` — auth + required `platform` (one of
 * spotify/applemusic/deezer/amazon/youtube) and `id` (the platform-native
 * playlist ID; format varies by platform, e.g. Spotify base62, Apple/Deezer
 * numeric). Discovery by name is the caller's job via `GET /api/research`.
 *
 * @param request - The incoming HTTP request.
 */
export async function validateGetResearchPlaylistRequest(
  request: NextRequest,
): Promise<NextResponse | ValidatedGetResearchPlaylistRequest> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(request.url);
  const platform = searchParams.get("platform");
  const id = searchParams.get("id");

  if (!platform || !id) {
    return errorResponse("platform and id parameters are required", 400);
  }
  if (!VALID_PLATFORMS.includes(platform)) {
    return errorResponse(`Invalid platform. Must be one of: ${VALID_PLATFORMS.join(", ")}`, 400);
  }

  return { accountId: authResult.accountId, platform, id };
}
