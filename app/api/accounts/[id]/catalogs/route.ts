import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getCatalogsHandler } from "@/lib/catalog/getCatalogsHandler";

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
 * GET /api/accounts/{id}/catalogs
 *
 * Lists catalogs linked to the supplied account.
 *
 * @param request - The request object
 * @param options - Route options containing params
 * @param options.params - Route params containing the account ID
 * @returns A NextResponse with `{ status, catalogs }`
 */
export async function GET(request: NextRequest, options: { params: Promise<{ id: string }> }) {
  return getCatalogsHandler(request, options.params);
}
