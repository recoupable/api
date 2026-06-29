import { type NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import {
  RESEARCH_AUDIENCE_PLATFORM_SOURCES,
  type ResearchAudiencePlatform,
} from "@/lib/research/researchAudiencePlatforms";
import { validateArtistRequest } from "@/lib/research/validateArtistRequest";

const VALID_PLATFORMS = Object.keys(
  RESEARCH_AUDIENCE_PLATFORM_SOURCES,
) as ResearchAudiencePlatform[];

const DEFAULT_PLATFORM: ResearchAudiencePlatform = "instagram";

export type ValidatedGetResearchAudienceRequest = {
  accountId: string;
  artist: string;
  artistId?: string;
  platform: ResearchAudiencePlatform;
};

/**
 * Validates `GET /api/research/audience` — auth, `artist`, and `platform` enum.
 * Defaults `platform` to `instagram` when omitted or blank.
 *
 * @param request - The incoming HTTP request.
 */
export async function validateGetResearchAudienceRequest(
  request: NextRequest,
): Promise<NextResponse | ValidatedGetResearchAudienceRequest> {
  const platformParam = new URL(request.url).searchParams.get("platform");
  const platform = (platformParam?.trim() || DEFAULT_PLATFORM) as ResearchAudiencePlatform;

  if (!VALID_PLATFORMS.includes(platform)) {
    return errorResponse(
      `Invalid platform. Must be one of: ${VALID_PLATFORMS.toSorted().join(", ")}`,
      400,
    );
  }

  const validated = await validateArtistRequest(request);
  if (validated instanceof NextResponse) return validated;

  return { ...validated, platform };
}
