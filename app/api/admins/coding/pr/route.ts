import { type NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getPrStatusHandler } from "@/lib/admins/pr/getPrStatusHandler";

/**
 * Handles GET requests.
 *
 * @param request - Incoming HTTP request.
 * @returns - Computed result.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return getPrStatusHandler(request);
}

/**
 * Handles OPTIONS requests.
 *
 * @returns - Computed result.
 */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}
