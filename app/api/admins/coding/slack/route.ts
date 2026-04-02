import { type NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getSlackTagsHandler } from "@/lib/admins/slack/getSlackTagsHandler";

/**
 * GET /api/admins/coding/slack
 *
 * Returns Slack tagging analytics for the Recoup Coding Agent bot.
 * Pulls directly from the Slack API as the source of truth.
 * Supports period filtering: all (default), daily, weekly, monthly.
 * Requires admin authentication.
 *
 * @param request
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return getSlackTagsHandler(request);
}

/** CORS preflight handler. */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}
