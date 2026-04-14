import { type NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getPrivyLoginsHandler } from "@/lib/admins/privy/getPrivyLoginsHandler";

/**
 * GET.
 *
 * @param request - Parameter.
 * @returns - Result.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return getPrivyLoginsHandler(request);
}

/**
 * OPTIONS.
 *
 * @returns - Result.
 */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}
