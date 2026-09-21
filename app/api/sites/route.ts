import { NextRequest } from "next/server";
import { siteOperationHandler } from "@/lib/sites/siteOperationHandler";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
export const maxDuration = 300;
/**
 * List sites in the authenticated workspace.
 *
 * @param request - Request or route context.
 * @returns HTTP response.
 */
export async function GET(request: NextRequest) {
  return siteOperationHandler(request, "list", Object.fromEntries(request.nextUrl.searchParams));
}
/**
 * Create a private, durable draft.
 *
 * @param request - Request or route context.
 * @returns HTTP response.
 */
export async function POST(request: NextRequest) {
  return siteOperationHandler(request, "create", await request.json().catch(() => null));
}
/**
 * Browser preflight.
 *
 * @returns HTTP response.
 */
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}
