import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getAccountHandler } from "@/lib/accounts/getAccountHandler";

/**
 * Handles OPTIONS requests.
 *
 * @returns - Computed result.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(),
  });
}

/**
 * Handles GET requests.
 *
 * @param request - Incoming HTTP request.
 * @param root1 - Input object.
 * @param root1.params - Dynamic route parameters.
 * @returns - Computed result.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return getAccountHandler(request, params);
}
