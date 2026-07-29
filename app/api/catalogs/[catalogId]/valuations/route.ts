import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getCatalogValuationsHandler } from "@/lib/catalog/getCatalogValuationsHandler";

/**
 * OPTIONS /api/catalogs/{catalogId}/valuations — CORS preflight.
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
 * GET /api/catalogs/{catalogId}/valuations — the catalog's persisted
 * valuation history, latest-first (limit=1 is the current value).
 *
 * @param request - The request object.
 * @param options - Route options containing params.
 * @param options.params - Route params containing the catalogId.
 * @returns A NextResponse with the valuation series.
 */
export async function GET(
  request: NextRequest,
  options: { params: Promise<{ catalogId: string }> },
) {
  const { catalogId } = await options.params;
  return getCatalogValuationsHandler(request, catalogId);
}
