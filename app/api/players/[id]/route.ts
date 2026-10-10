import { NextRequest } from "next/server";
import { playerOperationHandler } from "@/lib/players/playerOperationHandler";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
type Context = { params: Promise<{ id: string }> };
/**
 * Read private player settings and public share links.
 *
 * @param request - Incoming HTTP request.
 * @param context - Route parameters.
 * @returns HTTP response.
 */
export async function GET(request: NextRequest, context: Context) {
  const { id } = await context.params;
  return playerOperationHandler(request, "get", {
    ...Object.fromEntries(request.nextUrl.searchParams),
    id,
  });
}
/**
 * Publish/unpublish a player with optimistic revision checking.
 *
 * @param request - Incoming HTTP request.
 * @param context - Route parameters.
 * @returns HTTP response.
 */
export async function PATCH(request: NextRequest, context: Context) {
  const { id } = await context.params;
  return playerOperationHandler(request, "update", {
    ...(await request.json().catch(() => null)),
    id,
  });
}
/**
 * Browser preflight.
 *
 * @returns HTTP response.
 */
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}
