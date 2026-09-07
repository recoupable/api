import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Builds a JSON error response in the standard `{ status: "error", error }`
 * envelope with CORS headers. Use in place of inlining
 * `NextResponse.json({ status: "error", error }, { status, headers: getCorsHeaders() })`.
 *
 * @param error - Human-readable error message, or the documented error code
 * @param status - HTTP status code (e.g. 400, 403, 429, 500)
 * @param extra - Further documented fields for this response (e.g.
 *   `missing_fields` on a validation 400, `message` beside an error code).
 *   `status` and `error` always win over anything passed here.
 */
export function errorResponse(
  error: string,
  status: number,
  extra: Record<string, unknown> = {},
): NextResponse {
  return NextResponse.json(
    { ...extra, status: "error", error },
    { status, headers: getCorsHeaders() },
  );
}
