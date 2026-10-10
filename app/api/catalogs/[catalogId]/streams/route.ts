import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import type { NextRequest } from "next/server";
import { catalogStreamsHandler } from "@/lib/catalog/catalogStreamsHandler";
/**
 * GET saved calendar-day stream history and equal-period comparisons.
 *
 * @param request - Incoming authenticated request.
 * @param context - Route context.
 * @param context.params - Authoritative catalog path parameters.
 * @returns The catalog response or an authentication/validation error.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ catalogId: string }> },
) {
  return catalogStreamsHandler(request, (await context.params).catalogId, "history");
}

/**
 * Answer browser preflight for authenticated cross-origin calls.
 *
 * @returns CORS preflight response.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}
