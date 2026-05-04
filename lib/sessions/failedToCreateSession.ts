import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * 500 response shared by every internal failure on `POST /api/sessions`.
 * Returns the standard `{status, error}` envelope with the generic
 * `"Internal server error"` message — specific failure modes are logged
 * server-side rather than leaked to clients.
 */
export function failedToCreateSession(): NextResponse {
  return NextResponse.json(
    { status: "error", error: "Internal server error" },
    { status: 500, headers: getCorsHeaders() },
  );
}
