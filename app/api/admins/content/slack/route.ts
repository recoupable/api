import { type NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getContentSlackTagsHandler } from "@/lib/admins/content/getContentSlackTagsHandler";

/**
 * GET /api/admins/content/slack
 *
 * Returns Slack tagging analytics for the Recoup Content Agent bot.
 * Pulls directly from the Slack API as the source of truth.
 * Supports period filtering: all (default), daily, weekly, monthly.
 * Requires admin authentication.
 *
 * @param request - The incoming request; `period` is read from the query string
 *   and admin auth from the `x-api-key` / `Authorization: Bearer` header.
 * @returns A 200 NextResponse with the tagging analytics payload, 400 on invalid
 *   `period`, or 401/403 for non-admin callers.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return getContentSlackTagsHandler(request);
}

/**
 * CORS preflight handler for /api/admins/content/slack.
 *
 * @returns A 204 NextResponse carrying the CORS headers.
 */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}
