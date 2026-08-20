import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getRunsHandler } from "@/lib/runs/getRunsHandler";

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
 * GET handler for the calling account's background runs (chat#1973).
 *
 * @param request - The request object carrying kind and limit query params.
 * @returns A NextResponse with the account's runs, newest first.
 */
export async function GET(request: NextRequest) {
  return getRunsHandler(request);
}

// Clients poll this endpoint for in-flight run status; a cached response would
// freeze the state they are polling for.
export const dynamic = "force-dynamic";
