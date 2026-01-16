import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getAgentTemplatesHandler } from "@/lib/agentTemplates/getAgentTemplatesHandler";

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
 * GET /api/agent-templates
 *
 * Fetch agent templates accessible to the authenticated user.
 *
 * Authentication: Authorization Bearer token required.
 *
 * Query parameters:
 * - userId: Optional user ID (defaults to authenticated user)
 *
 * @param request - The request object
 * @returns A NextResponse with the templates array or an error
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return getAgentTemplatesHandler(request);
}
