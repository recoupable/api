import { type NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { successResponse } from "@/lib/networking/successResponse";
import { handleResearch } from "@/lib/research/handleResearch";
import { validateGetResearchCuratorRequest } from "@/lib/research/validateGetResearchCuratorRequest";

/**
 * GET /api/research/curator
 *
 * Returns details for a specific playlist curator. Not artist-scoped — keyed by
 * `platform` and `id` query params, proxied to `/curator/{platform}/{id}`.
 *
 * @param request - The incoming HTTP request.
 * @returns The JSON response.
 */
export async function getResearchCuratorHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validateGetResearchCuratorRequest(request);
    if (validated instanceof NextResponse) return validated;

    const result = await handleResearch({
      accountId: validated.accountId,
      path: `/curator/${validated.platform}/${validated.id}`,
    });

    if ("error" in result) return errorResponse(result.error, result.status);

    const data = result.data;
    const body =
      typeof data === "object" && data !== null && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : { data };
    return successResponse(body);
  } catch (error) {
    console.error("[ERROR] getResearchCuratorHandler:", error);
    return errorResponse("Internal error", 500);
  }
}
