import { type NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { successResponse } from "@/lib/networking/successResponse";
import { getAlbumPlaycounts } from "@/lib/research/playcounts/getAlbumPlaycounts";
import { validateGetResearchPlaycountsRequest } from "@/lib/research/playcounts/validateGetResearchPlaycountsRequest";

/**
 * GET /api/research/playcounts
 *
 * Latest platform-displayed play counts for all tracks on an album, served
 * from the measurement store (populated by snapshots). Counts are scraped
 * from public pages — not royalty-bearing stream counts.
 *
 * @param request - The incoming HTTP request.
 * @returns The JSON response.
 */
export async function getResearchPlaycountsHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validateGetResearchPlaycountsRequest(request);
    if (validated instanceof NextResponse) return validated;

    const result = await getAlbumPlaycounts(validated);
    if ("error" in result) return errorResponse(result.error, result.status);

    return successResponse(result.data as Record<string, unknown>);
  } catch (error) {
    console.error("[ERROR] getResearchPlaycountsHandler:", error);
    return errorResponse("Internal error", 500);
  }
}
