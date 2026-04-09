import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { editHandler } from "@/lib/content/edit/editHandler";

/**
 * OPTIONS handler for CORS preflight requests.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}

/**
 * PATCH /api/content
 *
 * Edit media with operations or a template preset.
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  return editHandler(request);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
