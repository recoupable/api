import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getTrackMeasurementsHandler } from "@/lib/research/measurements/getTrackMeasurementsHandler";

export const maxDuration = 60;

/**
 * OPTIONS /api/research/tracks/{id}/measurements — CORS preflight.
 *
 * @returns CORS-enabled 200 response
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * GET /api/research/tracks/{id}/measurements — a track's measured series, or a
 * derived `aggregate=run_rate` projection.
 *
 * @param request - The incoming HTTP request.
 * @param options - Route options containing params.
 * @param options.params - Route params containing the track id.
 * @returns JSON measurements or error
 */
export async function GET(request: NextRequest, options: { params: Promise<{ id: string }> }) {
  const { id } = await options.params;
  return getTrackMeasurementsHandler(request, id);
}
