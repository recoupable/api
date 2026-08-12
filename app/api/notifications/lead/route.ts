import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { postLeadNotificationHandler } from "@/lib/notifications/postLeadNotificationHandler";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns A NextResponse with CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}

/**
 * POST /api/notifications/lead
 *
 * Pages the admin Telegram chat when the marketing site captures a lead.
 * Unauthenticated by decision (chat#1800, 2026-08-12) — the public capture
 * forms feeding it make endpoint auth moot; revisit if spammed.
 *
 * Body parameters:
 * - email (required): the lead's email address
 * - source (required): the capturing surface, e.g. `/advisory/book`
 * - name, company, role, package, rosterSize, message (optional): triage fields
 *
 * Returns `{ status, notified }` — `notified` is false for internal test
 * addresses, which are filtered out of the channel by design.
 *
 * @param request - The request object.
 * @returns A NextResponse describing whether a message was sent.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return postLeadNotificationHandler(request);
}
