import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { updateCatalogHandler } from "@/lib/catalog/updateCatalogHandler";

/**
 * OPTIONS /api/catalogs/{catalogId} — CORS preflight.
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
 * PATCH /api/catalogs/{catalogId} — rename a catalog visible to the
 * authenticated account.
 *
 * @param request - The request object containing `{ name }`.
 * @param options - Route options containing params.
 * @param options.params - Route params containing the catalogId.
 * @returns A NextResponse with the renamed catalog.
 */
export async function PATCH(
  request: NextRequest,
  options: { params: Promise<{ catalogId: string }> },
) {
  const { catalogId } = await options.params;
  return updateCatalogHandler(request, catalogId);
}
