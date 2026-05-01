import { type NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getPrStatusHandler } from "@/lib/admins/pr/getPrStatusHandler";

/**
 * GET /api/admins/coding/pr
 *
 * Returns the status (open, closed, or merged) for each provided GitHub PR URL.
 * Accepts one or more `pull_requests` query parameters (GitHub PR URLs).
 * Uses the GitHub REST API to check each PR's state.
 * Requires admin authentication.
 *
 * @param request - The incoming request; `pull_requests` is read from the query string
 *   and admin auth from the `x-api-key` / `Authorization: Bearer` header.
 * @returns A 200 NextResponse with `{ results: Array<{ url, state }> }`, 400 when no
 *   `pull_requests` are supplied, or 401/403 for non-admin callers.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return getPrStatusHandler(request);
}

/**
 * CORS preflight handler for /api/admins/coding/pr.
 *
 * @returns A 204 NextResponse carrying the CORS headers.
 */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}
