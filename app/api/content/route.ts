import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { editHandler } from "@/lib/content/edit/editHandler";

/**
 * OPTIONS.
 *
 * @returns - Result.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}

/**
 * PATCH.
 *
 * @param request - Parameter.
 * @returns - Result.
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  return editHandler(request);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
