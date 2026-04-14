import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { editHandler } from "@/lib/content/edit/editHandler";

/**
 * Handles OPTIONS requests.
 *
 * @returns - Computed result.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}

/**
 * Handles PATCH requests.
 *
 * @param request - Incoming HTTP request.
 * @returns - Computed result.
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  return editHandler(request);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
