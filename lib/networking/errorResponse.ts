import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Builds a JSON error response with CORS headers. Use this instead of
 * inlining `NextResponse.json({ error }, { status, headers: getCorsHeaders() })`
 * at every API error return site.
 *
 * @param error - Human-readable error message
 * @param status - HTTP status code (e.g. 400, 403, 429, 500)
 * @returns NextResponse carrying `{ error }` at the given status
 */
export function errorResponse(error: string, status: number): NextResponse {
  return NextResponse.json({ error }, { status, headers: getCorsHeaders() });
}
