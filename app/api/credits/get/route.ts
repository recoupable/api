import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getCreditsHandler } from "@/lib/credits/getCreditsHandler";

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns A NextResponse with CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(),
  });
}

/**
 * GET /api/credits/get?accountId=xxx
 *
 * Returns the credits row for the given account (auto-refilling on
 * monthly cadence or just-activated subscription). No authentication
 * required.
 *
 * @param request - The incoming HTTP request.
 * @returns A NextResponse with `{ data }` on 200 or `{ message }` on 400/500.
 */
export async function GET(request: NextRequest) {
  return getCreditsHandler(request);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
