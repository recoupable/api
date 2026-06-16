import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getAlbumMeasurementsHandler } from "@/lib/research/measurements/getAlbumMeasurementsHandler";

export const maxDuration = 60;

/**
 * OPTIONS /api/research/albums/{id}/measurements — CORS preflight.
 *
 * @returns CORS-enabled 200 response
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * GET /api/research/albums/{id}/measurements — latest measured count per track.
 *
 * @param request - The incoming HTTP request.
 * @param options - Route options containing params.
 * @param options.params - Route params containing the album id.
 * @returns JSON album measurements or error
 */
export async function GET(request: NextRequest, options: { params: Promise<{ id: string }> }) {
  const { id } = await options.params;
  return getAlbumMeasurementsHandler(request, id);
}
