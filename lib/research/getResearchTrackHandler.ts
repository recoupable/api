import { type NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { successResponse } from "@/lib/networking/successResponse";
import { handleResearch } from "@/lib/research/handleResearch";
import { validateGetResearchTrackRequest } from "@/lib/research/validateGetResearchTrackRequest";

/**
 * GET /api/research/track
 *
 * Returns provider track details for the supplied `id`. Discovery (search by
 * name, filter by artist) is the caller's job via `GET /api/research?type=tracks`.
 *
 * @param request - must include `id` query param
 * @returns JSON track details or error
 */
export async function getResearchTrackHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validateGetResearchTrackRequest(request);
    if (validated instanceof NextResponse) return validated;
    const result = await handleResearch({
      accountId: validated.accountId,
      path: `/track/${validated.id}`,
    });

    if ("error" in result) return errorResponse("Failed to fetch track details", result.status);

    const data = result.data;
    const body =
      typeof data === "object" && data !== null && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : { data };
    return successResponse(body);
  } catch (error) {
    console.error("[ERROR] getResearchTrackHandler:", error);
    return errorResponse("Internal error", 500);
  }
}
