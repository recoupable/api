import { NextRequest } from "next/server";
import { startFanConnection } from "@/lib/sites/fanConnection/startFanConnection";
/**
 * Show the site's combined fan connection acceptance page.
 *
 * @param request - HTTP request.
 * @param root0 - Route context.
 * @param root0.params - Site route parameters.
 * @returns HTTP response.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return startFanConnection(request, (await params).id);
}
/**
 * Begin Spotify authorization following the fan's acceptance.
 *
 * @param request - HTTP request.
 * @param root0 - Route context.
 * @param root0.params - Site route parameters.
 * @returns HTTP response.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return startFanConnection(request, (await params).id);
}
