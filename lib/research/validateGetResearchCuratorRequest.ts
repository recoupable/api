import { type NextRequest, NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { errorResponse } from "@/lib/networking/errorResponse";

const VALID_PLATFORMS = ["spotify", "applemusic", "deezer"] as const;
type Platform = (typeof VALID_PLATFORMS)[number];

export type ValidatedGetResearchCuratorRequest = {
  accountId: string;
  platform: Platform;
  id: string;
};

/**
 * Validates `GET /api/research/curator` — auth + required `platform` (enum)
 * and `id` (numeric Chartmetric curator ID).
 *
 * @param request - The incoming HTTP request.
 */
export async function validateGetResearchCuratorRequest(
  request: NextRequest,
): Promise<NextResponse | ValidatedGetResearchCuratorRequest> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(request.url);
  const platform = searchParams.get("platform");
  const id = searchParams.get("id");

  if (!platform) return errorResponse("platform parameter is required", 400);
  if (!id) return errorResponse("id parameter is required", 400);

  if (!VALID_PLATFORMS.includes(platform as Platform)) {
    return errorResponse(`Invalid platform. Must be one of: ${VALID_PLATFORMS.join(", ")}`, 400);
  }

  if (!/^\d+$/.test(id)) {
    return errorResponse("id must be a numeric Chartmetric curator ID (e.g. 2 for Spotify)", 400);
  }

  return { accountId: authResult.accountId, platform: platform as Platform, id };
}
