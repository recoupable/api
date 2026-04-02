import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { editHandler } from "@/lib/content/primitives/editHandler";

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns Empty 204 response with CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}

/**
 * POST /api/content/edit
 *
 * Edit media with an operations pipeline or a template preset.
 */
export { editHandler as POST };

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
