import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { updateCatalogHandler } from "@/lib/catalog/updateCatalogHandler";
import { deleteCatalogHandler } from "@/lib/catalog/deleteCatalogHandler";

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

/**
 * DELETE /api/catalogs/{catalogId} — delete a catalog visible to the
 * authenticated account, keeping the measurement snapshot that produced it.
 *
 * @param request - The request object.
 * @param options - Route options containing params.
 * @param options.params - Route params containing the catalogId.
 * @returns A NextResponse with the deleted catalog id and the snapshots it released.
 */
export async function DELETE(
  request: NextRequest,
  options: { params: Promise<{ catalogId: string }> },
) {
  const { catalogId } = await options.params;
  return deleteCatalogHandler(request, catalogId);
}
