import { type NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { successResponse } from "@/lib/networking/successResponse";
import { handleResearch } from "@/lib/research/handleResearch";
import { validateGetResearchGenresRequest } from "@/lib/research/validateGetResearchGenresRequest";

/**
 * GET /api/research/genres
 *
 * Returns all available genre IDs and names. Not artist-scoped.
 *
 * @param request - The incoming HTTP request.
 * @returns The JSON response.
 */
export async function getResearchGenresHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validateGetResearchGenresRequest(request);
    if (validated instanceof NextResponse) return validated;

    const result = await handleResearch({
      accountId: validated.accountId,
      path: "/genres",
    });

    if ("error" in result) return errorResponse(result.error, result.status);
    return successResponse({ genres: Array.isArray(result.data) ? result.data : [] });
  } catch (error) {
    console.error("[ERROR] getResearchGenresHandler:", error);
    return errorResponse("Internal error", 500);
  }
}
