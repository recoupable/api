import { type NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { successResponse } from "@/lib/networking/successResponse";
import { getTrackMeasurements } from "@/lib/research/measurements/getTrackMeasurements";
import { validateGetTrackMeasurementsRequest } from "@/lib/research/measurements/validateGetTrackMeasurementsRequest";

/**
 * GET /api/research/tracks/{id}/measurements
 *
 * A track's measured series from the store, or — with `aggregate=run_rate` —
 * the trailing-window annualized run-rate. Consolidates `track/historic-stats`
 * and `track/playcount-deltas`.
 *
 * @param request - The incoming HTTP request.
 * @param id - The provider-neutral track id from the path.
 * @returns The JSON response.
 */
export async function getTrackMeasurementsHandler(
  request: NextRequest,
  id: string,
): Promise<NextResponse> {
  try {
    const validated = await validateGetTrackMeasurementsRequest(request, id);
    if (validated instanceof NextResponse) return validated;

    const result = await getTrackMeasurements(validated);
    if ("error" in result) return errorResponse(result.error, result.status);

    return successResponse(result.data as Record<string, unknown>);
  } catch (error) {
    console.error("[ERROR] getTrackMeasurementsHandler:", error);
    return errorResponse("Internal error", 500);
  }
}
