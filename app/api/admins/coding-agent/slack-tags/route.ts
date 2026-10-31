import { type NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getSlackTagOptionsHandler } from "@/lib/admins/coding-agent/getSlackTagOptionsHandler";

/**
 * GET /api/admins/coding-agent/slack-tags
 * Returns { status, total, tags: [{ id, name, avatar }] } for collected mention authors.
 * Requires admin authentication. Uses the existing all-period collector and its history limits.
 *
 * @param request - Request carrying the existing admin authentication headers.
 * @returns Filter options, 401/403 for non-admin callers, or 500 on collection failure.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return getSlackTagOptionsHandler(request);
}

/**
 * Returns CORS preflight headers without collecting Slack data.
 *
 * @returns An empty 204 response with existing CORS headers.
 */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}
