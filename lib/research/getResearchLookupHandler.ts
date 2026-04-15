import { type NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { successResponse } from "@/lib/networking/successResponse";
import { handleResearch } from "@/lib/research/handleResearch";
import { validateGetResearchLookupRequest } from "@/lib/research/validateGetResearchLookupRequest";

/**
 * GET /api/research/lookup
 *
 * Resolves a Spotify artist URL to Chartmetric IDs via the get-ids endpoint.
 *
 * @param request - Requires `url` query param containing a Spotify artist URL
 * @returns The JSON response.
 */
export async function getResearchLookupHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validateGetResearchLookupRequest(request);
    if (validated instanceof NextResponse) return validated;

    const result = await handleResearch({
      accountId: validated.accountId,
      path: `/artist/spotify/${validated.spotifyId}/get-ids`,
    });

    if ("error" in result) return errorResponse("Lookup failed", result.status);

    const data = result.data;
    const body =
      typeof data === "object" && data !== null && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : { data };
    return successResponse(body);
  } catch (error) {
    console.error("[ERROR] getResearchLookupHandler:", error);
    return errorResponse("Internal error", 500);
  }
}
