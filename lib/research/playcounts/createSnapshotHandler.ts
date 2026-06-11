import { type NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { createSnapshot } from "@/lib/research/playcounts/createSnapshot";
import { validateCreateSnapshotRequest } from "@/lib/research/playcounts/validateCreateSnapshotRequest";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * POST /api/research/snapshots
 *
 * Capture platform-displayed play counts for a whole catalog, album list, or
 * ISRC list in one server-side snapshot. Executes asynchronously; the cost
 * estimate is returned (202) before any scraper spend.
 *
 * @param request - The incoming HTTP request.
 * @returns The JSON response.
 */
export async function createSnapshotHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validateCreateSnapshotRequest(request);
    if (validated instanceof NextResponse) return validated;

    const result = await createSnapshot(validated);
    if ("error" in result) return errorResponse(result.error, result.status);

    return NextResponse.json(result.data, { status: 202, headers: getCorsHeaders() });
  } catch (error) {
    console.error("[ERROR] createSnapshotHandler:", error);
    return errorResponse("Internal error", 500);
  }
}
