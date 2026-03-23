import { type NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getPrMergedStatusHandler } from "@/lib/admins/pr/getPrMergedStatusHandler";

/**
 * GET /api/admins/coding/pr
 *
 * Returns the merged status for each provided GitHub pull request URL.
 * Accepts one or more `pull_requests` query parameters (GitHub PR URLs).
 * Uses the GitHub REST API to check merge status.
 * Requires admin authentication.
 *
 * @param request
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return getPrMergedStatusHandler(request);
}

/** CORS preflight handler. */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}
