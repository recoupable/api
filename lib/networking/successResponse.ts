import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Wraps a success payload in the standard `{ status: "success", ...body }`
 * envelope with CORS headers. Pairs with {@link errorResponse}.
 *
 * @param body - Fields to spread at the root of the response.
 */
export function successResponse(body: Record<string, unknown>): NextResponse {
  return NextResponse.json(
    { status: "success", ...body },
    { status: 200, headers: getCorsHeaders() },
  );
}
