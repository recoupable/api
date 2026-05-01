import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { validateArtistRequest } from "@/lib/research/validateArtistRequest";
import { handleArtistResearch } from "@/lib/research/handleArtistResearch";
import { successResponse } from "@/lib/networking/successResponse";
import { errorResponse } from "@/lib/networking/errorResponse";

/**
 * GET /api/research/audience
 *
 * Returns audience demographic stats for the given artist on a specific platform.
 * Accepts optional `platform` query param (defaults to "instagram").
 * The platform is embedded in the path, not passed as a query param.
 *
 * @param request - The incoming HTTP request.
 * @returns The JSON response.
 */
export async function getResearchAudienceHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validateArtistRequest(request);
    if (validated instanceof NextResponse) return validated;

    const { searchParams } = new URL(request.url);
    const platform = searchParams.get("platform") || "instagram";

    const result = await handleArtistResearch({
      ...validated,
      path: cmId => `/artist/${cmId}/${platform}-audience-stats`,
    });

    if ("error" in result) return errorResponse(result.error, result.status);
    const data = result.data;
    const body =
      typeof data === "object" && data !== null && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : { data };
    return successResponse(body);
  } catch (error) {
    console.error("[ERROR] getResearchAudienceHandler:", error);
    return errorResponse("Internal error", 500);
  }
}
