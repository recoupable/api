import { type NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { successResponse } from "@/lib/networking/successResponse";
import { handleResearchProxy } from "@/lib/research/handleResearchProxy";
import { validateGetResearchDiscoverRequest } from "@/lib/research/validateGetResearchDiscoverRequest";

/**
 * GET /api/research/discover
 *
 * Filters artists by country, genre, listener ranges, and growth rate.
 *
 * @param request - The incoming HTTP request.
 * @returns The JSON response.
 */
export async function getResearchDiscoverHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validateGetResearchDiscoverRequest(request);
    if (validated instanceof NextResponse) return validated;

    const query: Record<string, string> = {};
    if (validated.country) query.code2 = validated.country;
    if (validated.genre) query.tagId = validated.genre;
    if (validated.sort) query.sortColumn = validated.sort;
    if (validated.limit !== undefined) query.limit = String(validated.limit);
    if (
      validated.sp_monthly_listeners_min !== undefined &&
      validated.sp_monthly_listeners_max !== undefined
    ) {
      query["sp_ml[]"] =
        `${validated.sp_monthly_listeners_min},${validated.sp_monthly_listeners_max}`;
    } else if (validated.sp_monthly_listeners_min !== undefined) {
      query["sp_ml[]"] = String(validated.sp_monthly_listeners_min);
    } else if (validated.sp_monthly_listeners_max !== undefined) {
      query["sp_ml[]"] = String(validated.sp_monthly_listeners_max);
    }

    const result = await handleResearchProxy({
      accountId: validated.accountId,
      path: "/artist/list/filter",
      query,
    });

    if ("error" in result) return errorResponse(result.error, result.status);
    return successResponse({ artists: Array.isArray(result.data) ? result.data : [] });
  } catch (error) {
    console.error("[ERROR] getResearchDiscoverHandler:", error);
    return errorResponse("Internal error", 500);
  }
}
