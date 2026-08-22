import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getMusicGenerationHandler } from "@/lib/music/getMusicGenerationHandler";

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns A 204 NextResponse carrying the CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}

/**
 * GET /api/music/{generationId}
 *
 * One generation and its workflow timeline (contract: recoupable/docs#308).
 * This is what a client polls while a song renders.
 *
 * @param request - The incoming request.
 * @param context - Route params carrying the generation id.
 * @param context.params - Promise resolving to the route's `generationId`.
 * @returns 200 with the generation, 400 on a malformed id, 403 without access,
 *   404 when it does not exist, or 500.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ generationId: string }> },
): Promise<NextResponse> {
  const { generationId } = await context.params;
  return getMusicGenerationHandler(request, generationId);
}

// Clients poll this while a generation is in flight; a cached response would
// freeze the state they are polling for.
export const dynamic = "force-dynamic";
