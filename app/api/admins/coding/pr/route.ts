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
 * @param request - The incoming request with pull_requests query params
 * @returns A NextResponse with the PR status for each provided URL
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return getPrStatusHandler(request);
}

/**
 * CORS preflight handler.
 *
 * @returns A NextResponse with CORS headers allowing cross-origin access
 */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}
