import { type NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { successResponse } from "@/lib/networking/successResponse";
import { getAlbumMeasurements } from "@/lib/research/measurements/getAlbumMeasurements";
import { validateGetAlbumMeasurementsRequest } from "@/lib/research/measurements/validateGetAlbumMeasurementsRequest";

/**
 * GET /api/research/albums/{id}/measurements
 *
 * Latest measured count per track on an album, from the store. Consolidates
 * `GET /api/research/playcounts`.
 *
 * @param request - The incoming HTTP request.
 * @param id - The Spotify album id from the path.
 * @returns The JSON response.
 */
export async function getAlbumMeasurementsHandler(
  request: NextRequest,
  id: string,
): Promise<NextResponse> {
  try {
    const validated = await validateGetAlbumMeasurementsRequest(request, id);
    if (validated instanceof NextResponse) return validated;

    const result = await getAlbumMeasurements(validated);
    if ("error" in result) return errorResponse(result.error, result.status);

    return successResponse(result.data as Record<string, unknown>);
  } catch (error) {
    console.error("[ERROR] getAlbumMeasurementsHandler:", error);
    return errorResponse("Internal error", 500);
  }
}
