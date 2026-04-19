import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

export function validationErrorResponse(
  message: string,
  path: Array<string | number>,
): NextResponse {
  return NextResponse.json(
    { status: "error", missing_fields: path, error: message },
    { status: 400, headers: getCorsHeaders() },
  );
}
