import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { createCatalogHandler } from "@/lib/catalog/createCatalogHandler";

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
 * POST handler for creating a catalog (optionally materialized from a
 * valuation snapshot).
 *
 * @param request - The request object containing the catalog body.
 * @returns A NextResponse with the created catalog.
 */
export async function POST(request: NextRequest) {
  return createCatalogHandler(request);
}
