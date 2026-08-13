import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { postLeadsHandler } from "@/lib/leads/postLeadsHandler";

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
 * POST /api/leads
 *
 * Captures a marketing-site lead: stores it in Attio (person + triage note),
 * then pages the admin Telegram chat with an Attio deep link — the api-side
 * owner of marketing capture per the 2026-08-13 decision on
 * recoupable/chat#1800, modeled on the valuation funnel's
 * `captureValuationLead`.
 *
 * Unauthenticated by decision (chat#1800, 2026-08-12): the public forms
 * feeding it make endpoint auth moot; revisit if spammed.
 *
 * Body: a discriminated union on `kind` —
 * - `booking`: name + package required; company, role, rosterSize, message optional
 * - `subscribe`: email + source; name, company, utm_*, audit_answers,
 *   audit_score, roi_inputs, roi_results optional
 *
 * Returns 200 `{ status, notified, record_url }` when stored (`notified` is
 * false for internal test addresses, filtered by design), 400 on a bad body,
 * and **502 when the lead could not be stored** — callers must surface it.
 *
 * @param request - The request object.
 * @returns A NextResponse describing the capture outcome.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return postLeadsHandler(request);
}
