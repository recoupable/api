import { type NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { successResponse } from "@/lib/networking/successResponse";
import { handleResearch } from "@/lib/research/handleResearch";
import { validateGetResearchFestivalsRequest } from "@/lib/research/validateGetResearchFestivalsRequest";

/**
 * GET /api/research/festivals
 *
 * Returns a list of music festivals. Not artist-scoped — `/festival/list` is a
 * global Chartmetric endpoint, so this uses `handleResearch`.
 *
 * @param request - The incoming HTTP request.
 * @returns The JSON response.
 */
export async function getResearchFestivalsHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validateGetResearchFestivalsRequest(request);
    if (validated instanceof NextResponse) return validated;

    const result = await handleResearch({
      accountId: validated.accountId,
      path: "/festival/list",
    });

    if ("error" in result) return errorResponse(result.error, result.status);
    return successResponse({ festivals: Array.isArray(result.data) ? result.data : [] });
  } catch (error) {
    console.error("[ERROR] getResearchFestivalsHandler:", error);
    return errorResponse("Internal error", 500);
  }
}
