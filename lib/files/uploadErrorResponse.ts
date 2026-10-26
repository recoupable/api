import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/** Preserve the upload client's existing error envelope, including CORS. */
export function uploadErrorResponse(status: number, error: string): NextResponse {
  return NextResponse.json({ success: false, error }, { status, headers: getCorsHeaders() });
}
