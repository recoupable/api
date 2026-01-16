import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getArtistAgentsHandler } from "@/lib/artistAgents/getArtistAgentsHandler";

/**
 * OPTIONS handler for CORS preflight requests.
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
 * GET /api/artist-agents
 *
 * Fetch artist agents by social IDs.
 *
 * Authentication: x-api-key header OR Authorization Bearer token required.
 * Exactly one authentication mechanism must be provided.
 *
 * Query parameters:
 * - socialId: One or more social IDs (can be repeated, e.g., ?socialId=123&socialId=456)
 *
 * @param request - The request object
 * @returns A NextResponse with the agents array or an error
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return getArtistAgentsHandler(request);
}
