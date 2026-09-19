import { NextRequest } from "next/server";
import { siteOperationHandler } from "@/lib/sites/siteOperationHandler";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
/**
 * Read fan signups only after verifying workspace access.
 *
 * @param request - Request or route context.
 * @param root0 - Request or route context.
 * @param root0.params - Request or route context.
 * @returns HTTP response.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return siteOperationHandler(request, "signups", await params);
}
/**
 * Browser preflight.
 *
 * @returns HTTP response.
 */
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}
