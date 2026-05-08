import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getSandboxReconnectHandler } from "@/lib/sandbox/getSandboxReconnectHandler";

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
 * `GET /api/sandbox/reconnect?sessionId=...` — live runtime probe to
 * decide whether the sandbox bound to a session is still reachable.
 *
 * @param request - The incoming request.
 * @returns A NextResponse with `{ status, hasSnapshot, expiresAt?, lifecycle }` on 200, or an error.
 */
export async function GET(request: NextRequest) {
  return getSandboxReconnectHandler(request);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
