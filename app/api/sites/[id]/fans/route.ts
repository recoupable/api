import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { NextRequest } from "next/server";
import { fanConnectionHandler } from "@/lib/sites/fanConnection/fanConnectionHandler";
/**
 * List Spotify-connected fans and their grants in the authorized workspace.
 *
 * @param request - HTTP request.
 * @param root0 - Route context.
 * @param root0.params - Site route parameters.
 * @returns HTTP response.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return fanConnectionHandler(request, (await params).id, "fans");
}

/** Browser preflight for the authenticated customer dashboard.
 *
 * @returns HTTP response.
 */
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}
