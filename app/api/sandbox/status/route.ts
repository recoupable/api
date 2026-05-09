import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getSandboxStatusHandler } from "@/lib/sandbox/getSandboxStatusHandler";

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns A NextResponse with CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(),
  });
}

/**
 * `GET /api/sandbox/status?sessionId=...` — current lifecycle/runtime state for the sandbox bound to a session.
 *
 * @param request - The incoming request.
 * @returns A NextResponse with `{ status, hasSnapshot, lifecycleVersion, lifecycle }` on 200, or an error.
 */
export async function GET(request: NextRequest) {
  return getSandboxStatusHandler(request);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
