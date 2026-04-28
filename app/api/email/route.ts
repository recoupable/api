import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { trackEmailHandler } from "@/lib/email/trackEmailHandler";

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns A NextResponse with CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(),
  });
}

/**
 * GET /api/email?email=<url-encoded-email>
 *
 * Fire-and-forget Loops contact tracking. Calls `loopsClient.updateContact`.
 * Returns `{ success, message, id }` on 200, `{ message }` on 400.
 *
 * @param request - The incoming request with the `email` query param.
 * @returns A NextResponse with the Loops response shape.
 */
export async function GET(request: NextRequest) {
  return trackEmailHandler(request);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
