import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { validateArtistRequest } from "@/lib/research/validateArtistRequest";
import { handleArtistResearch } from "@/lib/research/handleArtistResearch";
import { successResponse } from "@/lib/networking/successResponse";
import { errorResponse } from "@/lib/networking/errorResponse";

/**
 * GET /api/research/instagram-posts
 *
 * Returns recent Instagram posts for the given artist via Chartmetric's
 * DeepSocial integration.
 * Requires `artist` query param.
 *
 * @param request - The incoming HTTP request.
 * @returns The JSON response.
 */
export async function getResearchInstagramPostsHandler(
  request: NextRequest,
): Promise<NextResponse> {
  try {
    const validated = await validateArtistRequest(request);
    if (validated instanceof NextResponse) return validated;

    const result = await handleArtistResearch({
      ...validated,
      path: cmId => `/SNS/deepSocial/cm_artist/${cmId}/instagram`,
    });

    if ("error" in result) return errorResponse(result.error, result.status);
    const data = result.data;
    const body =
      typeof data === "object" && data !== null && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : { data };
    return successResponse(body);
  } catch (error) {
    console.error("[ERROR] getResearchInstagramPostsHandler:", error);
    return errorResponse("Internal error", 500);
  }
}
