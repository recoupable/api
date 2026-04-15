import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Wraps a success payload in the standard `{ status: "success", ...body }`
 * envelope with CORS headers applied.
 *
 * @param body - Fields to spread at the root of the response.
 */
export function jsonSuccess(body: Record<string, unknown>): NextResponse {
  return NextResponse.json(
    { status: "success", ...body },
    { status: 200, headers: getCorsHeaders() },
  );
}

/**
 * Returns an error response with the standard `{ status: "error", error }`
 * envelope and CORS headers.
 *
 * @param status - HTTP status code
 * @param error - Human-readable error message
 */
export function jsonError(status: number, error: string): NextResponse {
  return NextResponse.json({ status: "error", error }, { status, headers: getCorsHeaders() });
}
