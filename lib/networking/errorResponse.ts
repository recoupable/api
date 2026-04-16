import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Builds a JSON error response in the standard `{ status: "error", error }`
 * envelope with CORS headers. Use in place of inlining
 * `NextResponse.json({ status: "error", error }, { status, headers: getCorsHeaders() })`.
 *
 * @param error - Human-readable error message
 * @param status - HTTP status code (e.g. 400, 403, 429, 500)
 */
export function errorResponse(error: string, status: number): NextResponse {
  return NextResponse.json({ status: "error", error }, { status, headers: getCorsHeaders() });
}
