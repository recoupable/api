import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getCatalogMeasurementsHandler } from "@/lib/catalog/getCatalogMeasurementsHandler";

/**
 * OPTIONS handler for CORS preflight requests.
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
 * GET handler for retrieving a catalog's latest per-song play counts and the
 * derived valuation band.
 *
 * @param request - The request object containing the catalogId query parameter.
 * @returns A NextResponse with measurements, valuation band, and totals.
 */
export async function GET(request: NextRequest) {
  return getCatalogMeasurementsHandler(request);
}
