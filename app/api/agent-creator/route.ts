import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getAgentCreatorHandler } from "@/lib/agentCreator/getAgentCreatorHandler";

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
 * GET /api/agent-creator
 *
 * Fetch agent creator information for display in the UI.
 *
 * This is a public endpoint that does not require authentication.
 *
 * Query parameters:
 * - creatorId: Required - The account ID of the agent creator
 *
 * @param request - The request object
 * @returns A NextResponse with creator info (name, image, is_admin) or an error
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return getAgentCreatorHandler(request);
}
