import { NextRequest } from "next/server";
import { fanConnectionHandler } from "@/lib/sites/fanConnection/fanConnectionHandler";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
/**
 * Reports activity only after checking the customer's workspace access.
 *
 * @param request - Incoming site request.
 * @param root0 - Route context.
 * @param root0.params - Site identifier.
 * @returns HTTP response.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return fanConnectionHandler(request, (await params).id, "activity");
}
/** Browser preflight for customer activity reports.
 *
 * @returns HTTP response.
 */
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}
