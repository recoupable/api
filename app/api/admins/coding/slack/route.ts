import { type NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getSlackTagsHandler } from "@/lib/admins/slack/getSlackTagsHandler";

/**
 * Handles GET requests.
 *
 * @param request - Incoming HTTP request.
 * @returns - Computed result.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return getSlackTagsHandler(request);
}

/**
 * Handles OPTIONS requests.
 *
 * @returns - Computed result.
 */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}
