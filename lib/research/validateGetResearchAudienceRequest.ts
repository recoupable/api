import { type NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { validateArtistRequest } from "./validateArtistRequest";
import { researchAudiencePlatformSchema } from "./researchAudiencePlatformSchema";
import type { ResearchAudiencePlatform } from "./researchAudiencePlatforms";

type ValidatedAudienceRequest = Exclude<
  Awaited<ReturnType<typeof validateArtistRequest>>,
  NextResponse
> & {
  platform: ResearchAudiencePlatform;
};

/** Rejects unsupported platforms before the existing auth/artist/credit operation. */
export async function validateGetResearchAudienceRequest(
  request: NextRequest,
): Promise<NextResponse | ValidatedAudienceRequest> {
  const raw = request.nextUrl.searchParams.get("platform")?.trim() || "instagram";
  const parsed = researchAudiencePlatformSchema.safeParse(raw);
  if (!parsed.success) {
    return errorResponse(
      `Invalid platform. Must be one of: ${[...researchAudiencePlatformSchema.options].sort().join(", ")}`,
      400,
    );
  }
  const validated = await validateArtistRequest(request);
  if (validated instanceof NextResponse) return validated;
  return { ...validated, platform: parsed.data };
}
