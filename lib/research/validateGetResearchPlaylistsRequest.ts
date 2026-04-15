import { type NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { validateArtistRequest } from "@/lib/research/validateArtistRequest";

const VALID_PLATFORMS = ["spotify", "applemusic", "deezer", "amazon", "youtube"] as const;
const VALID_STATUSES = ["current", "past"] as const;

type Platform = (typeof VALID_PLATFORMS)[number];
type Status = (typeof VALID_STATUSES)[number];

export type ValidatedGetResearchPlaylistsRequest = {
  accountId: string;
  artist: string;
  platform: Platform;
  status: Status;
};

/**
 * Validates `GET /api/research/playlists` — auth, `artist`, and
 * `platform`/`status` enums (defaults to `spotify` / `current`).
 *
 * @param request - The incoming HTTP request.
 */
export async function validateGetResearchPlaylistsRequest(
  request: NextRequest,
): Promise<NextResponse | ValidatedGetResearchPlaylistsRequest> {
  const { searchParams } = new URL(request.url);
  const platform = (searchParams.get("platform") ?? "spotify") as Platform;
  const status = (searchParams.get("status") ?? "current") as Status;

  if (!VALID_PLATFORMS.includes(platform)) {
    return errorResponse(`Invalid platform. Must be one of: ${VALID_PLATFORMS.join(", ")}`, 400);
  }
  if (!VALID_STATUSES.includes(status)) {
    return errorResponse(`Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`, 400);
  }

  const validated = await validateArtistRequest(request);
  if (validated instanceof NextResponse) return validated;

  return { ...validated, platform, status };
}
