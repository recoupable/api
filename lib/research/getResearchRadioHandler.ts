import { type NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { successResponse } from "@/lib/networking/successResponse";
import { handleResearchProxy } from "@/lib/research/handleResearchProxy";
import { validateGetResearchRadioRequest } from "@/lib/research/validateGetResearchRadioRequest";

/**
 * GET /api/research/radio
 *
 * Returns a list of radio stations. Not artist-scoped.
 *
 * @param request - The incoming HTTP request.
 * @returns The JSON response.
 */
export async function getResearchRadioHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validateGetResearchRadioRequest(request);
    if (validated instanceof NextResponse) return validated;

    const result = await handleResearchProxy({
      accountId: validated.accountId,
      path: "/radio/station-list",
    });

    if ("error" in result) return errorResponse(result.error, result.status);
    return successResponse({ stations: Array.isArray(result.data) ? result.data : [] });
  } catch (error) {
    console.error("[ERROR] getResearchRadioHandler:", error);
    return errorResponse("Internal error", 500);
  }
}
