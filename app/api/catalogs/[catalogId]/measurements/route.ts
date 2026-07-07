import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getCatalogMeasurementsHandler } from "@/lib/catalog/getCatalogMeasurementsHandler";

/**
 * OPTIONS /api/catalogs/{catalogId}/measurements — CORS preflight.
 *
 * @returns A NextResponse with CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(),
  });
}

/**
 * GET /api/catalogs/{catalogId}/measurements — one page of a catalog's
 * latest per-song play counts plus whole-scope aggregates and the derived
 * valuation band.
 *
 * @param request - The request object.
 * @param options - Route options containing params.
 * @param options.params - Route params containing the catalogId.
 * @returns A NextResponse with measurements, pagination, and aggregates.
 */
export async function GET(
  request: NextRequest,
  options: { params: Promise<{ catalogId: string }> },
) {
  const { catalogId } = await options.params;
  return getCatalogMeasurementsHandler(request, catalogId);
}
