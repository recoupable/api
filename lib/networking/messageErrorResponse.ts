import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import type { MessageErrorResponseBody } from "@/lib/networking/errorResponseSchemas";

/** Preserve the authentication envelope consumed by existing clients. */
export function messageErrorResponse(
  message: string,
  status: number,
): NextResponse<MessageErrorResponseBody> {
  return NextResponse.json<MessageErrorResponseBody>(
    { status: "error", message },
    { status, headers: getCorsHeaders() },
  );
}
