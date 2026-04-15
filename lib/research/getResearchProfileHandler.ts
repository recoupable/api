import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { validateArtistRequest } from "@/lib/research/validateArtistRequest";
import { handleArtistResearch } from "@/lib/research/handleArtistResearch";
import { successResponse } from "@/lib/networking/successResponse";
import { errorResponse } from "@/lib/networking/errorResponse";

/**
 * GET /api/research/profile
 *
 * Returns the full Chartmetric artist profile for the given artist.
 * Requires `artist` query param (name, numeric ID, or UUID).
 *
 * @param request - The incoming HTTP request.
 * @returns The JSON response.
 */
export async function getResearchProfileHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validateArtistRequest(request);
    if (validated instanceof NextResponse) return validated;

    const result = await handleArtistResearch({
      artist: validated.artist,
      accountId: validated.accountId,
      path: cmId => `/artist/${cmId}`,
    });

    if ("error" in result) return errorResponse(result.error, result.status);
    const data = result.data;
    const body =
      typeof data === "object" && data !== null && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : { data };
    return successResponse(body);
  } catch (error) {
    console.error("[ERROR] getResearchProfileHandler:", error);
    return errorResponse("Internal error", 500);
  }
}
