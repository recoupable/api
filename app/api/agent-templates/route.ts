import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getAgentTemplatesHandler } from "@/lib/agent_templates/getAgentTemplatesHandler";

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
 * Authentication: exactly one of `x-api-key` or `Authorization: Bearer`.
 * Resolves the account from auth; no query parameters.
 *
 * @param request - The incoming request
 * @returns A NextResponse with the JSON template array or an error body
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return getAgentTemplatesHandler(request);
}

export const dynamic = "force-dynamic";
export const revalidate = 0;
