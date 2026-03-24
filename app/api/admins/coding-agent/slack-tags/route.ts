import { type NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getSlackTagOptionsHandler } from "@/lib/admins/coding-agent/getSlackTagOptionsHandler";

/**
 * GET /api/admins/coding-agent/slack-tags
 *
 * Returns the distinct set of Slack users who have tagged the Recoup Coding Agent bot.
 * Used by the admin UI to populate tag filter chips.
 * Requires admin authentication.
 *
 * @param request
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return getSlackTagOptionsHandler(request);
}

/** CORS preflight handler. */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}
