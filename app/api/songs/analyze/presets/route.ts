import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getFlamingoPresetsHandler } from "@/lib/flamingo/getFlamingoPresetsHandler";

/**
 * OPTIONS.
 *
 * @returns - Result.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(),
  });
}

/**
 * GET.
 *
 * @param request - Parameter.
 * @returns - Result.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return getFlamingoPresetsHandler(request);
}
