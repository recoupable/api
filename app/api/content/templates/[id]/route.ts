import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getContentTemplateDetailHandler } from "@/lib/content/getContentTemplateDetailHandler";

/**
 * Handles OPTIONS requests.
 *
 * @returns - Computed result.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}

/**
 * Handles GET requests.
 *
 * @param request - Incoming HTTP request.
 * @param context - Route handler context.
 * @param context.params - Dynamic route parameters.
 * @returns - Computed result.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  return getContentTemplateDetailHandler(request, context);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
