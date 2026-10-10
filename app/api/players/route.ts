import { NextRequest } from "next/server";
import { playerOperationHandler } from "@/lib/players/playerOperationHandler";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
/**
 * List release players in the authenticated workspace.
 *
 * @param request - Incoming HTTP request.
 * @returns HTTP response.
 */
export async function GET(request: NextRequest) {
  return playerOperationHandler(request, "list", Object.fromEntries(request.nextUrl.searchParams));
}
/**
 * Register reusable release destinations and approved embed origins. Disabled by default.
 *
 * @param request - Incoming HTTP request.
 * @returns HTTP response.
 */
export async function POST(request: NextRequest) {
  return playerOperationHandler(request, "create", await request.json().catch(() => null));
}
/**
 * Browser preflight.
 *
 * @returns HTTP response.
 */
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}
