import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getAccountHandler } from "@/lib/accounts/getAccountHandler";

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
 * @param root1 - Parameter.
 * @param root1.params - Parameter.
 * @returns - Result.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return getAccountHandler(request, params);
}
