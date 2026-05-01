import { type NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { successResponse } from "@/lib/networking/successResponse";
import { handleResearch } from "@/lib/research/handleResearch";
import { validateGetResearchChartsRequest } from "@/lib/research/validateGetResearchChartsRequest";

/**
 * GET /api/research/charts
 *
 * Returns global chart positions for a platform. Not artist-scoped.
 * Requires `platform` query param. Optional: `country`, `interval`, `type`, `latest`.
 *
 * @param request - The incoming HTTP request.
 * @returns The JSON response.
 */
export async function getResearchChartsHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validateGetResearchChartsRequest(request);
    if (validated instanceof NextResponse) return validated;

    const result = await handleResearch({
      accountId: validated.accountId,
      path: `/charts/${validated.platform}`,
      query: {
        country_code: validated.country,
        interval: validated.interval,
        type: validated.type,
        latest: validated.latest,
      },
    });

    if ("error" in result) return errorResponse(result.error, result.status);

    const data = result.data;
    const body =
      typeof data === "object" && data !== null && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : { data };
    return successResponse(body);
  } catch (error) {
    console.error("[ERROR] getResearchChartsHandler:", error);
    return errorResponse("Internal error", 500);
  }
}
