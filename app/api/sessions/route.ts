import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { createSessionHandler } from "@/lib/sessions/createSessionHandler";

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
 * `POST /api/sessions` — create a session and an initial chat.
 *
 * @param request - The incoming request.
 * @returns A NextResponse with `{ session, chat }` on 200, or an error.
 */
export async function POST(request: NextRequest) {
  return createSessionHandler(request);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
