import { type NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getAgentSignupsHandler } from "@/lib/admins/agent-signups/getAgentSignupsHandler";

/**
 * GET /api/admins/agent-signups
 * Returns { status, total, signups } containing API-key record metadata for accounts
 * with an agent-prefixed email. This is not a unique-agent or verified-origin count.
 * Supports all (default), daily, weekly and monthly UTC calendar periods.
 *
 * @param request - Request carrying existing admin authentication and optional period.
 * @returns The returned records, 400 for invalid period, 401/403 for non-admins, or 500.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return getAgentSignupsHandler(request);
}

/**
 * Answers CORS preflight without accessing signup metadata.
 *
 * @returns An empty 204 response with existing CORS headers.
 */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}
