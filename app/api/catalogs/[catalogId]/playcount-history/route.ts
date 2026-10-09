import { type NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getCatalogPlaycountHistoryHandler } from "@/lib/catalog/getCatalogPlaycountHistoryHandler";

/**
 * CORS preflight for catalog playcount history.
 *
 * @returns CORS response.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * GET saved catalog observations and comparable-period changes, without collection or billing.
 *
 * @param request - Authenticated request.
 * @param context - Awaitable Next.js catalog path parameters.
 * @param context.params - Catalog path parameters.
 * @returns Authenticated history response.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ catalogId: string }> },
) {
  const { catalogId } = await context.params;
  return getCatalogPlaycountHistoryHandler(request, catalogId);
}
