import { type NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { successResponse } from "@/lib/networking/successResponse";
import { getPlaycountDeltas } from "@/lib/research/playcounts/getPlaycountDeltas";
import { validateGetPlaycountDeltasRequest } from "@/lib/research/playcounts/validateGetPlaycountDeltasRequest";

/**
 * GET /api/research/track/playcount-deltas
 *
 * Play-count change between snapshots for one recording, with an annualized
 * run-rate. Requires at least two captures in the window; returns an empty
 * `deltas` array (not an error) when history is insufficient.
 *
 * @param request - The incoming HTTP request.
 * @returns The JSON response.
 */
export async function getPlaycountDeltasHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validateGetPlaycountDeltasRequest(request);
    if (validated instanceof NextResponse) return validated;

    const result = await getPlaycountDeltas(validated);
    if ("error" in result) return errorResponse(result.error, result.status);

    return successResponse(result.data as Record<string, unknown>);
  } catch (error) {
    console.error("[ERROR] getPlaycountDeltasHandler:", error);
    return errorResponse("Internal error", 500);
  }
}
