import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { createImageHandler } from "@/lib/content/image/createImageHandler";

/**
 * Handles OPTIONS requests.
 *
 * @returns - Computed result.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}

/**
 * Handles POST requests.
 *
 * @param request - Incoming HTTP request.
 * @returns - Computed result.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return createImageHandler(request);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
