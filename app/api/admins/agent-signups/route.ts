import { type NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getAgentSignupsHandler } from "@/lib/admins/agent-signups/getAgentSignupsHandler";

/**
 * GET /api/admins/agent-signups
 *
 * Returns API key sign-up records created by AI agents.
 * Supports period filtering: all, daily, weekly, monthly.
 * Requires admin authentication.
 *
 * @param request
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return getAgentSignupsHandler(request);
}

/**
 *
 */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}
